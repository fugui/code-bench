package handlers

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"code-bench/database"
	"code-bench/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
)

func GetDepartments(c *gin.Context) {
	var depts []models.Department
	if err := database.DB.Preload("Leader").Find(&depts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for i := range depts {
		var userCount int64
		database.DB.Model(&models.User{}).Where("department_id = ?", depts[i].ID).Count(&userCount)
		depts[i].UserCount = userCount

		var repoCount int64
		database.DB.Model(&models.Repository{}).Where("department_id = ?", depts[i].ID).Count(&repoCount)
		depts[i].RepoCount = repoCount
	}

	c.JSON(http.StatusOK, depts)
}

func CreateDepartment(c *gin.Context) {
	var dept models.Department
	if err := c.ShouldBindJSON(&dept); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&dept).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Broadcast sync
	BroadcastSync("upsert", "/api/sync/department", dept.ID, dept)

	c.JSON(http.StatusCreated, dept)
}

func UpdateDepartment(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Name     string `json:"name"`
		LeaderID *uint  `json:"leader_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var dept models.Department
	if err := database.DB.First(&dept, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Department not found"})
		return
	}

	if req.Name != "" {
		dept.Name = req.Name
	}
	if req.LeaderID != nil {
		if *req.LeaderID == 0 {
			dept.LeaderID = nil
		} else {
			dept.LeaderID = req.LeaderID
		}
	}

	if err := database.DB.Save(&dept).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update department"})
		return
	}

	// Broadcast sync
	BroadcastSync("upsert", "/api/sync/department", dept.ID, dept)

	c.JSON(http.StatusOK, dept)
}

func DeleteDepartment(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var dept models.Department
	if err := database.DB.First(&dept, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "部门不存在"})
		return
	}

	var repoCount int64
	database.DB.Model(&models.Repository{}).Where("department_id = ?", dept.ID).Count(&repoCount)
	if repoCount > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": fmt.Sprintf("该部门下仍有 %d 个代码仓，请先移除或转移后再删除部门。", repoCount),
		})
		return
	}

	var userCount int64
	database.DB.Model(&models.User{}).Where("department_id = ?", dept.ID).Count(&userCount)
	if userCount > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": fmt.Sprintf("该部门下仍有 %d 名人员，请先移除或转移后再删除部门。", userCount),
		})
		return
	}

	if err := database.DB.Delete(&dept).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除部门失败"})
		return
	}

	// Broadcast delete
	BroadcastSync("delete", "/api/sync/department", uint(id), nil)

	c.JSON(http.StatusOK, gin.H{"message": "部门已删除"})
}

func ExportDepartments(c *gin.Context) {
	var depts []models.Department
	database.DB.Preload("Leader").Find(&depts)

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=departments.csv")

	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.Write([]string{"ID", "部门名称", "负责人ID", "负责人姓名", "创建时间"})
	for _, d := range depts {
		leaderIDStr := ""
		leaderName := ""
		if d.Leader != nil {
			leaderIDStr = strconv.Itoa(int(d.Leader.ID))
			leaderName = d.Leader.Name
		}
		writer.Write([]string{
			fmt.Sprintf("%d", d.ID),
			d.Name,
			leaderIDStr,
			leaderName,
			d.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}
}

func ImportDepartments(c *gin.Context) {
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

	requiredHeaders := []string{"部门名称"}
	for _, req := range requiredHeaders {
		if _, ok := headerMap[req]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Missing column: %s", req)})
			return
		}
	}

	records, err := reader.ReadAll()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read records"})
		return
	}

	successCount := 0
	for _, record := range records {
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

		name := getField("部门名称")
		leaderIDStr := getField("负责人ID")
		if leaderIDStr == "" {
			leaderIDStr = getField("负责人工号")
		}

		if name == "" {
			continue
		}

		var leaderID *uint
		if leaderIDStr != "" {
			var leader models.User
			if err := database.DB.Where("employee_id = ? OR email = ? OR id = ?", leaderIDStr, leaderIDStr, leaderIDStr).First(&leader).Error; err == nil {
				leaderID = &leader.ID
			}
		}

		var dept models.Department
		if err := database.DB.Where("name = ?", name).First(&dept).Error; err != nil {
			dept = models.Department{
				Name:     name,
				LeaderID: leaderID,
			}
			if err := database.DB.Create(&dept).Error; err == nil {
				successCount++
				BroadcastSync("upsert", "/api/sync/department", dept.ID, dept)
			}
		} else {
			if leaderID != nil {
				dept.LeaderID = leaderID
			}
			if err := database.DB.Save(&dept).Error; err == nil {
				successCount++
				BroadcastSync("upsert", "/api/sync/department", dept.ID, dept)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Successfully imported/updated %d departments", successCount)})
}

func UpdateMyDepartment(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User context missing"})
		return
	}

	var req struct {
		Department string `json:"department" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	deptName := strings.TrimSpace(req.Department)
	if deptName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Department name cannot be empty"})
		return
	}

	var dept models.Department
	err := database.DB.Where("name = ?", deptName).First(&dept).Error
	if err != nil {
		dept = models.Department{
			Name: deptName,
		}
		if createErr := database.DB.Create(&dept).Error; createErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create department"})
			return
		}
		BroadcastSync("upsert", "/api/sync/department", dept.ID, dept)
	}

	if err := database.DB.Model(&models.User{}).Where("id = ?", userID).Update("department_id", dept.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user department"})
		return
	}

	var updatedUser models.User
	if err := database.DB.Preload("Department").First(&updatedUser, userID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load user info"})
		return
	}

	// Sync the updated user info
	BroadcastSync("upsert", "/api/sync/user", updatedUser.ID, updatedUser)

	c.JSON(http.StatusOK, updatedUser)
}
