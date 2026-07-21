package handlers

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"code-bench/database"
	"code-bench/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
)

var syncingProjectIDs sync.Map
var lastSyncFailedTimes sync.Map
var projectIDSyncSem = make(chan struct{}, 5)

// prepareRequestHeaders 透传 Cookie, cftk 和 x-requested-with Header
func prepareRequestHeaders(c *gin.Context) map[string]string {
	headers := make(map[string]string)
	if cookie := c.GetHeader("Cookie"); cookie != "" {
		headers["Cookie"] = cookie
	}
	cftk := c.GetHeader("cftk")
	if cftk == "" {
		cftk, _ = c.Cookie("prod_cftk")
	}
	if cftk != "" {
		headers["cftk"] = cftk
	}
	headers["x-requested-with"] = "XMLHttpRequest"
	return headers
}

// formatURLToHTTPS 转换代码仓 URL 到 HTTPS 格式
func formatURLToHTTPS(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}

	rawURL = strings.TrimPrefix(rawURL, "ssh://")

	if strings.Contains(rawURL, "git@") {
		parts := strings.SplitN(rawURL, "git@", 2)
		afterGit := parts[1]

		// 匹配第一个 ":"，如果它后面跟着的不是数字，就把它换成 "/"
		reg := regexp.MustCompile(`:([^0-9])`)
		afterGit = reg.ReplaceAllString(afterGit, "/$1")

		return "https://" + afterGit
	}

	if strings.HasPrefix(rawURL, "http://") {
		return "https://" + strings.TrimPrefix(rawURL, "http://")
	}

	if strings.HasPrefix(rawURL, "https://") {
		return rawURL
	}

	return "https://" + rawURL
}

// extractRepoPath 提取不含协议、host 与末尾 .git 的仓库路径
func extractRepoPath(repoURL string) string {
	httpsURL := formatURLToHTTPS(repoURL)
	if httpsURL == "" {
		return ""
	}

	pathPart := strings.TrimPrefix(httpsURL, "https://")
	firstSlash := strings.Index(pathPart, "/")
	if firstSlash == -1 {
		return ""
	}
	pathPart = pathPart[firstSlash+1:]
	pathPart = strings.TrimSuffix(pathPart, ".git")
	return strings.Trim(pathPart, "/")
}

// fetchRepoDetailRemote 调用三方接口获取代码仓详情（ID、SSH URL、HTTP URL）
func fetchRepoDetailRemote(repoURL string, headers map[string]string) (string, string, string, error) {
	apiURL := models.AppConfig.Sync.RepoDetailURL
	if apiURL == "" {
		return "", "", "", fmt.Errorf("repo_detail_url not configured")
	}

	repoPath := extractRepoPath(repoURL)
	if repoPath == "" {
		return "", "", "", fmt.Errorf("invalid repository URL: %s", repoURL)
	}

	reqURL := fmt.Sprintf("%s?path=%s", apiURL, url.QueryEscape(repoPath))

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return "", "", "", err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", "", fmt.Errorf("remote API returned status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", err
	}

	trimmedBody := strings.TrimSpace(string(body))
	if trimmedBody == "" || trimmedBody == "null" {
		return "", "", "", fmt.Errorf("repository not found (empty response)")
	}

	// 响应数据中 { "id", "ssh_url_to_repo", "http_url_to_repo"}
	var result struct {
		ID            int    `json:"id"`
		SSHURLToRepo  string `json:"ssh_url_to_repo"`
		HTTPURLToRepo string `json:"http_url_to_repo"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		log.Printf("[ProjectIDSync] JSON unmarshal failed. URL: %s, Response Body: %s, Error: %v", reqURL, string(body), err)
		return "", "", "", fmt.Errorf("failed to parse JSON response: %w", err)
	}

	return strconv.Itoa(result.ID), result.SSHURLToRepo, result.HTTPURLToRepo, nil
}

// SyncRepoProjectIDAsync 异步查询外部接口并更新数据库中的 project_id 和 URL 详情
func SyncRepoProjectIDAsync(repoID uint, repoURL string, headers map[string]string) {
	if _, loaded := syncingProjectIDs.LoadOrStore(repoID, true); loaded {
		return
	}

	go func() {
		defer syncingProjectIDs.Delete(repoID)

		// 过滤冷却期内的失败同步请求，避免高频重复调用
		if val, ok := lastSyncFailedTimes.Load(repoID); ok {
			if lastFailed, ok := val.(time.Time); ok {
				if time.Since(lastFailed) < 10*time.Minute {
					return
				}
			}
		}

		// 申请并发名额（通道缓冲上限 5）
		projectIDSyncSem <- struct{}{}
		defer func() { <-projectIDSyncSem }()

		projectID, sshURL, httpURL, err := fetchRepoDetailRemote(repoURL, headers)
		if err != nil {
			// 记录失败时间，进入 10 分钟冷却期
			lastSyncFailedTimes.Store(repoID, time.Now())

			if strings.Contains(err.Error(), "repository not found") {
				log.Printf("[ProjectIDSync] Repo %d (%s) not found in remote codehub", repoID, repoURL)
			} else {
				log.Printf("[ProjectIDSync] Failed to fetch repo details for repo %d: %v", repoID, err)
			}
			return
		}

		// 同步成功，清除冷却记录
		lastSyncFailedTimes.Delete(repoID)

		if projectID != "" {
			updates := map[string]interface{}{
				"project_id": projectID,
			}
			if sshURL != "" {
				updates["url"] = sshURL
			}
			if httpURL != "" {
				updates["http_url"] = httpURL
			}
			if err := database.DB.Model(&models.Repository{}).Where("id = ?", repoID).Updates(updates).Error; err != nil {
				log.Printf("[ProjectIDSync] Failed to update repo details in db for repo %d: %v", repoID, err)
			} else {
				log.Printf("[ProjectIDSync] Successfully updated project_id %s, ssh_url %s, http_url %s for repo %d", projectID, sshURL, httpURL, repoID)
				var updatedRepo models.Repository
				if err := database.DB.Preload("Department").Preload("Owner").First(&updatedRepo, repoID).Error; err == nil {
					BroadcastSync("upsert", "/api/sync/repo", repoID, updatedRepo)
				}
			}
		}
	}()
}

func GetRepos(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "15"))
	deptID := c.Query("department_id")
	if deptID == "" {
		deptID = c.Query("team_id")
	}
	serviceGroup := c.Query("service_group")
	owner := c.Query("owner")
	repoName := c.Query("name")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 15
	}
	if pageSize > 10000 {
		pageSize = 10000
	}

	query := database.DB.Model(&models.Repository{})

	if deptID != "" {
		query = query.Where("department_id = ?", deptID)
	}
	if serviceGroup != "" {
		query = query.Where("service_group LIKE ?", "%"+serviceGroup+"%")
	}
	if owner != "" {
		query = query.Joins("LEFT JOIN users ON repositories.owner_id = users.id").
			Where("users.name LIKE ? OR users.employee_id LIKE ? OR users.email LIKE ?", "%"+owner+"%", "%"+owner+"%", "%"+owner+"%")
	}
	if repoName != "" {
		query = query.Where("repositories.name LIKE ?", "%"+repoName+"%")
	}

	var total int64
	query.Count(&total)

	var repos []models.Repository
	offset := (page - 1) * pageSize
	query.Preload("Department").Preload("Owner").Offset(offset).Limit(pageSize).Find(&repos)

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))

	c.JSON(http.StatusOK, gin.H{
		"items":      repos,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": totalPages,
	})
}

func CreateRepo(c *gin.Context) {
	var repo models.Repository
	if err := c.ShouldBindJSON(&repo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	headers := prepareRequestHeaders(c)
	apiURL := models.AppConfig.Sync.RepoDetailURL
	if apiURL != "" {
		projectID, sshURL, httpURL, err := fetchRepoDetailRemote(repo.URL, headers)
		if err != nil {
			// 如果明确是未找到仓库或 URL 不合法，进行强校验拦截
			if strings.Contains(err.Error(), "repository not found") || strings.Contains(err.Error(), "invalid repository URL") {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("无法在托管平台找到该代码仓，请检查 URL 是否正确。错误: %v", err)})
				return
			}
			// 临时/环境网络错误判定
			if repo.ProjectID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("无法连接托管平台查询项目详情，请确认三方服务状态或稍后重试。错误: %v", err)})
				return
			}
			log.Printf("[CreateRepo] Warning: Failed to query remote detail, but user provided project_id. Error: %v", err)
		} else {
			if projectID != "" {
				repo.ProjectID = projectID
			}
			if sshURL != "" {
				repo.URL = sshURL
			}
			if httpURL != "" {
				repo.HTTPURL = httpURL
			}
		}
	}

	if err := database.DB.Create(&repo).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload with associations to get Owner and Department details for sync
	database.DB.Preload("Department").Preload("Owner").First(&repo, repo.ID)

	// Broadcast sync
	BroadcastSync("upsert", "/api/sync/repo", repo.ID, repo)

	c.JSON(http.StatusCreated, repo)
}

func DeleteRepo(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	if err := database.DB.Delete(&models.Repository{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete repository"})
		return
	}

	// Broadcast delete
	BroadcastSync("delete", "/api/sync/repo", uint(id), nil)

	c.JSON(http.StatusOK, gin.H{"message": "Repository correctly deleted"})
}

func UpdateRepo(c *gin.Context) {
	id := c.Param("id")

	var repo models.Repository
	if err := database.DB.First(&repo, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Repository not found"})
		return
	}

	var input struct {
		Name           *string   `json:"name"`
		URL            *string   `json:"url"`
		OwnerID        *uint     `json:"owner_id"`
		Branch         *string   `json:"branch"`
		DepartmentID   *uint     `json:"department_id"`
		TeamID         *uint     `json:"team_id"`
		ServiceGroup   *string   `json:"service_group"`
		RelatedMembers *[]string `json:"related_members"`
		ProjectID      *string   `json:"project_id"`
		HTTPURL        *string   `json:"http_url"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if input.Name != nil {
		updates["name"] = *input.Name
	}

	urlChanged := input.URL != nil && *input.URL != repo.URL
	var syncSuccess bool

	if urlChanged {
		headers := prepareRequestHeaders(c)
		apiURL := models.AppConfig.Sync.RepoDetailURL
		if apiURL != "" {
			projectID, sshURL, httpURL, err := fetchRepoDetailRemote(*input.URL, headers)
			if err != nil {
				// 如果明确是未找到仓库或 URL 不合法，进行强校验拦截
				if strings.Contains(err.Error(), "repository not found") || strings.Contains(err.Error(), "invalid repository URL") {
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("无法在托管平台找到该代码仓，请检查 URL 是否正确。错误: %v", err)})
					return
				}
				// 判定是否有可用的 projectID 进行容灾
				targetProjectID := ""
				if input.ProjectID != nil {
					targetProjectID = *input.ProjectID
				} else {
					targetProjectID = repo.ProjectID
				}
				if targetProjectID == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("修改 URL 时无法连接托管平台查询项目详情，且无可用 project_id，请稍后重试。错误: %v", err)})
					return
				}
				log.Printf("[UpdateRepo] Warning: Failed to query remote detail for updated URL %s, but project_id is available. Error: %v", *input.URL, err)
				updates["url"] = *input.URL
			} else {
				syncSuccess = true
				if projectID != "" {
					updates["project_id"] = projectID
				}
				if sshURL != "" {
					updates["url"] = sshURL
				} else {
					updates["url"] = *input.URL
				}
				if httpURL != "" {
					updates["http_url"] = httpURL
				}
			}
		} else {
			updates["url"] = *input.URL
		}
	} else if input.URL != nil {
		updates["url"] = *input.URL
	}

	if input.OwnerID != nil {
		updates["owner_id"] = *input.OwnerID
	}
	if input.Branch != nil {
		updates["branch"] = *input.Branch
	}
	if input.DepartmentID != nil {
		updates["department_id"] = *input.DepartmentID
	} else if input.TeamID != nil {
		updates["department_id"] = *input.TeamID
	}
	if input.ServiceGroup != nil {
		updates["service_group"] = *input.ServiceGroup
	}

	// 仅在 URL 未改变，或者 URL 改变但同步失败的情况下，才允许手动更新 project_id 和 http_url
	if !syncSuccess {
		if input.ProjectID != nil {
			updates["project_id"] = *input.ProjectID
		}
		if input.HTTPURL != nil {
			updates["http_url"] = *input.HTTPURL
		}
	}
	if input.RelatedMembers != nil {
		if len(*input.RelatedMembers) == 0 {
			updates["related_members"] = nil
		} else {
			b, _ := json.Marshal(*input.RelatedMembers)
			updates["related_members"] = b
		}
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	if err := database.DB.Model(&repo).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update repository"})
		return
	}

	// Reload with associations
	database.DB.Preload("Department").Preload("Owner").First(&repo, id)

	// Broadcast sync
	BroadcastSync("upsert", "/api/sync/repo", repo.ID, repo)

	c.JSON(http.StatusOK, repo)
}

func ExportRepos(c *gin.Context) {
	var repos []models.Repository
	database.DB.Preload("Department").Preload("Owner").Find(&repos)

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=repositories.csv")

	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.Write([]string{"ID", "代码仓名称", "Repo URL", "归属部门", "负责人ID", "负责人姓名", "分支", "服务组", "创建时间"})
	for _, r := range repos {
		deptName := ""
		if r.Department.Name != "" {
			deptName = r.Department.Name
		}
		ownerIDStr := ""
		ownerName := ""
		if r.Owner.ID != 0 {
			ownerName = r.Owner.Name
			ownerIDStr = r.Owner.EmployeeID
			if ownerIDStr == "" {
				ownerIDStr = r.Owner.Email
			}
		}
		writer.Write([]string{
			fmt.Sprintf("%d", r.ID),
			r.Name,
			r.URL,
			deptName,
			ownerIDStr,
			ownerName,
			r.Branch,
			r.ServiceGroup,
			r.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}
}

func parseRepoNameFromURL(repoURL string) string {
	if repoURL == "" {
		return ""
	}

	// Remove trailing .git
	path := strings.TrimSuffix(repoURL, ".git")

	// Remove common protocol prefixes
	prefixes := []string{"git+ssh://", "ssh://", "https://", "http://"}
	for _, pref := range prefixes {
		if strings.HasPrefix(path, pref) {
			path = strings.TrimPrefix(path, pref)
			break
		}
	}

	// Separate Host and Path
	if idx := strings.Index(path, ":"); idx != -1 {
		afterColon := path[idx+1:]
		slashIdx := strings.Index(afterColon, "/")
		if slashIdx != -1 {
			isPort := true
			portStr := afterColon[:slashIdx]
			if len(portStr) == 0 {
				isPort = false
			}
			for _, r := range portStr {
				if r < '0' || r > '9' {
					isPort = false
					break
				}
			}
			if isPort {
				path = afterColon[slashIdx+1:]
				return strings.Trim(path, "/")
			}
		}

		if !strings.Contains(path[:idx], "/") {
			path = path[idx+1:]
		}
	} else if idx := strings.Index(path, "/"); idx != -1 {
		path = path[idx+1:]
	}

	return strings.Trim(path, "/")
}

func ImportRepos(c *gin.Context) {
	headers := prepareRequestHeaders(c)

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer src.Close()

	b, err := io.ReadAll(src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	var reader *csv.Reader
	if utf8.Valid(b) {
		reader = csv.NewReader(bytes.NewReader(b))
	} else {
		decodedReader := transform.NewReader(bytes.NewReader(b), simplifiedchinese.GB18030.NewDecoder())
		reader = csv.NewReader(decodedReader)
	}
	reader.FieldsPerRecord = -1

	header, err := reader.Read()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read CSV header"})
		return
	}

	headerMap := make(map[string]int)
	for i, col := range header {
		cleanCol := strings.ReplaceAll(strings.TrimRight(strings.TrimLeft(col, "\xef\xbb\xbf\"' \t\r\n"), "\"' \t\r\n"), " ", "")
		headerMap[cleanCol] = i
	}

	requiredHeaders := []string{"子系统", "田主", "RepoURL", "分支"}
	for _, req := range requiredHeaders {
		if _, ok := headerMap[req]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Missing required column: %s", req)})
			return
		}
	}

	records, err := reader.ReadAll()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read CSV records"})
		return
	}

	successCount := 0
	for lineNum, record := range records {
		if len(record) == 0 {
			continue
		}

		getField := func(key string) string {
			idx, ok := headerMap[key]
			if ok && idx < len(record) {
				return strings.TrimSpace(record[idx])
			}
			return ""
		}

		subsystem := getField("子系统")
		ownerName := getField("田主")
		repoName := getField("代码仓")
		repoURL := getField("RepoURL")
		branch := getField("分支")
		departmentName := getField("部门名称")

		if repoName == "" && repoURL != "" {
			repoName = parseRepoNameFromURL(repoURL)
		}

		if repoName == "" || repoURL == "" || ownerName == "" {
			continue
		}
		if branch == "" {
			branch = "master"
		}

		var user models.User
		if err := database.DB.Where("employee_id = ? OR email = ? OR name = ?", ownerName, ownerName, ownerName).First(&user).Error; err != nil {
			log.Printf("Line %d: Owner %s does not exist", lineNum+2, ownerName)
			continue
		}

		var dept models.Department
		if departmentName == "" {
			if user.DepartmentID != nil {
				if err := database.DB.Where("id = ?", *user.DepartmentID).First(&dept).Error; err != nil {
					log.Printf("Line %d: Failed to find department by owner's department_id %d: %v", lineNum+2, *user.DepartmentID, err)
					continue
				}
			} else {
				log.Printf("Line %d: Department name is empty and owner %s has no department associated", lineNum+2, ownerName)
				continue
			}
		} else {
			if err := database.DB.Where("name = ?", departmentName).First(&dept).Error; err != nil {
				dept = models.Department{
					Name:     departmentName,
					LeaderID: &user.ID,
				}
				if err := database.DB.Create(&dept).Error; err == nil {
					BroadcastSync("upsert", "/api/sync/department", dept.ID, dept)
				} else {
					log.Printf("Line %d: Failed to create department %s: %v", lineNum+2, departmentName, err)
					continue
				}
			}
		}

		// 校验远端仓库是否存在，并拉取最新 ProjectID、HTTP URL 等
		projectID, remoteSSHURL, httpURL, err := fetchRepoDetailRemote(repoURL, headers)
		if err != nil {
			log.Printf("Line %d: Failed to check remote repository for URL %s: %v. Row skipped.", lineNum+2, repoURL, err)
			continue
		}

		var repo models.Repository
		if err := database.DB.Where("name = ?", repoName).First(&repo).Error; err != nil {
			repo = models.Repository{
				DepartmentID: dept.ID,
				Name:         repoName,
				URL:          repoURL,
				Branch:       branch,
				ServiceGroup: subsystem,
				IsActive:     true,
			}
			repo.OwnerID = user.ID
			if projectID != "" {
				repo.ProjectID = projectID
			}
			if remoteSSHURL != "" {
				repo.URL = remoteSSHURL
			}
			if httpURL != "" {
				repo.HTTPURL = httpURL
			}
			if err := database.DB.Create(&repo).Error; err == nil {
				successCount++
				BroadcastSync("upsert", "/api/sync/repo", repo.ID, repo)

				// 匹配子系统架构元素并关联
				if subsystem != "" {
					var archElem models.ArchitectureElement
					if err := database.DB.Where("type = ? AND (identifier = ? OR name_cn = ? OR name_en = ?)", "subsystem", subsystem, subsystem, subsystem).First(&archElem).Error; err == nil {
						archElem.RepoID = &repo.ID
						database.DB.Save(&archElem)
						repo.ServiceGroup = archElem.Identifier
						database.DB.Model(&repo).Update("service_group", archElem.Identifier)
					}
				}
			} else {
				log.Printf("Line %d: Failed to create repository %s: %v", lineNum+2, repoName, err)
			}
		} else {
			repo.DepartmentID = dept.ID
			if remoteSSHURL != "" {
				repo.URL = remoteSSHURL
			} else {
				repo.URL = repoURL
			}
			repo.OwnerID = user.ID
			repo.Branch = branch
			repo.ServiceGroup = subsystem
			if projectID != "" {
				repo.ProjectID = projectID
			}
			if httpURL != "" {
				repo.HTTPURL = httpURL
			}
			if err := database.DB.Save(&repo).Error; err == nil {
				successCount++
				BroadcastSync("upsert", "/api/sync/repo", repo.ID, repo)

				// 匹配子系统架构元素并关联
				if subsystem != "" {
					var archElem models.ArchitectureElement
					if err := database.DB.Where("type = ? AND (identifier = ? OR name_cn = ? OR name_en = ?)", "subsystem", subsystem, subsystem, subsystem).First(&archElem).Error; err == nil {
						archElem.RepoID = &repo.ID
						database.DB.Save(&archElem)
						repo.ServiceGroup = archElem.Identifier
						database.DB.Model(&repo).Update("service_group", archElem.Identifier)
					}
				}
			} else {
				log.Printf("Line %d: Failed to update repository %s: %v", lineNum+2, repoName, err)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Successfully imported %d repositories", successCount)})
}
