package handlers

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"code-bench/database"
	"code-bench/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	testDSN := os.Getenv("TEST_DB_DSN")
	if testDSN != "" {
		_ = models.LoadConfig("../config.yaml")
		database.InitDB()
		database.DB.Exec("TRUNCATE TABLE architecture_elements, repositories, users, departments CASCADE")
	} else {
		_ = models.LoadConfig("../config.yaml")
		database.InitDB()
		// 安全保护：未显式指定测试数据库时，禁止清空主库，仅清理测试用例相关测试数据
		database.DB.Exec("DELETE FROM repositories WHERE id IN (1, 2, 10001, 10002, 10003, 10004, 10005, 99999)")
	}

	// 预置默认子系统 code-bench (若不存在)
	var count int64
	database.DB.Model(&models.ArchitectureElement{}).Where("id = ?", 1).Count(&count)
	if count == 0 {
		defaultArch := models.ArchitectureElement{
			ID:         1,
			Identifier: "code-bench",
			NameCn:     "代码度量",
			NameEn:     "Code Bench",
			Type:       "subsystem",
		}
		database.DB.Create(&defaultArch)
	}

	return database.DB
}

func TestImportReposNew(t *testing.T) {
	// 1. 初始化测试数据库
	db := setupTestDB(t)

	// 启动 Mock CodeHub 服务
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		resp := map[string]interface{}{
			"id":               10001,
			"ssh_url_to_repo":  "git@example.com:" + path + ".git",
			"http_url_to_repo": "https://example.com/" + path + ".git",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()
	models.AppConfig.Sync.RepoDetailURL = mockServer.URL

	// 2. 初始化一些基础数据
	dept := models.Department{
		ID:   1,
		Name: "技术部",
	}
	db.Create(&dept)

	deptID := dept.ID
	admin := models.User{
		ID:           1,
		EmployeeID:   "admin",
		Email:        "admin@code-shield.com",
		Name:         "管理员",
		DepartmentID: &deptID,
	}
	db.Create(&admin)

	// 3. 构建包含田主和子系统的导入 CSV（新仓库）
	csvContent := "代码仓,RepoURL,田主,分支,部门名称,子系统\n" +
		"test-repo-new,git@example.com:test/test-repo-new.git,admin,master,技术部,code-bench\n"

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "test.csv")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	part.Write([]byte(csvContent))
	writer.Close()

	// 4. 发起模拟的 HTTP 请求
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("POST", "/repos/import", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request = req

	// 5. 执行 ImportRepos
	ImportRepos(ctx)

	// 6. 验证返回值和数据库中的值
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
	}

	var imported models.Repository
	if err := db.Where("name = ?", "test-repo-new").First(&imported).Error; err != nil {
		t.Fatalf("failed to find imported repo: %v", err)
	}

	if imported.OwnerID != 1 {
		t.Errorf("expected OwnerID to be 1, but got %d", imported.OwnerID)
	}

	// 校验架构元素关联：匹配到子系统 "code-bench" 并设置了双向关联
	var updatedArch models.ArchitectureElement
	if err := db.First(&updatedArch, 1).Error; err != nil {
		t.Fatalf("failed to find arch element: %v", err)
	}
	if updatedArch.RepoID == nil || *updatedArch.RepoID != imported.ID {
		t.Errorf("expected ArchElement.RepoID to be %d, but got %v", imported.ID, updatedArch.RepoID)
	}

	if imported.ProjectID != "10001" {
		t.Errorf("expected ProjectID to be '10001', got %s", imported.ProjectID)
	}
	expectedHTTPURL := "https://example.com/test/test-repo-new.git"
	if imported.HTTPURL != expectedHTTPURL {
		t.Errorf("expected HTTPURL to be %q, got %q", expectedHTTPURL, imported.HTTPURL)
	}
}

func TestImportReposRejectDuplicate(t *testing.T) {
	// 1. 初始化测试数据库
	db := setupTestDB(t)

	// 启动 Mock CodeHub 服务
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		resp := map[string]interface{}{
			"id":               10001,
			"ssh_url_to_repo":  "git@example.com:" + path + ".git",
			"http_url_to_repo": "https://example.com/" + path + ".git",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()
	models.AppConfig.Sync.RepoDetailURL = mockServer.URL

	// 2. 初始化一些基础数据
	dept := models.Department{
		ID:   1,
		Name: "技术部",
	}
	db.Create(&dept)

	deptID := dept.ID
	admin := models.User{
		ID:           1,
		EmployeeID:   "admin",
		Email:        "admin@code-shield.com",
		Name:         "管理员",
		DepartmentID: &deptID,
	}
	db.Create(&admin)

	// 创建一个已有仓库
	oldRepo := models.Repository{
		ID:           1,
		DepartmentID: 1,
		Name:         "existing-repo",
		URL:          "git@example.com:test/existing-repo.git",
		HTTPURL:      "https://example.com/test/existing-repo.git",
		ProjectID:    "10001",
		OwnerID:      1,
		Branch:       "master",
		ServiceGroup: "code-bench",
		IsActive:     true,
	}
	db.Create(&oldRepo)

	// 3. 构建尝试导入同名或同 URL 仓库的 CSV
	csvContent := "代码仓,RepoURL,田主,分支,部门名称,子系统\n" +
		"existing-repo,git@example.com:test/existing-repo.git,admin,dev,技术部,code-bench\n"

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "test_dup.csv")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	part.Write([]byte(csvContent))
	writer.Close()

	// 4. 发起模拟的 HTTP 请求
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("POST", "/repos/import", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request = req

	// 5. 执行 ImportRepos
	ImportRepos(ctx)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Message        string `json:"message"`
		ImportedCount  int    `json:"imported_count"`
		DuplicateCount int    `json:"duplicate_count"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.ImportedCount != 0 {
		t.Errorf("expected imported_count 0, got %d", resp.ImportedCount)
	}
	if resp.DuplicateCount != 1 {
		t.Errorf("expected duplicate_count 1, got %d", resp.DuplicateCount)
	}

	// 验证已有仓库未被覆盖（分支仍为 master）
	var repoAfter models.Repository
	db.First(&repoAfter, 1)
	if repoAfter.Branch != "master" {
		t.Errorf("expected existing repo branch to remain 'master', but got %q", repoAfter.Branch)
	}
}

func TestGetReposFilterName(t *testing.T) {
	// 1. 初始化测试数据库
	db := setupTestDB(t)

	// 2. 插入测试部门、用户与仓库
	dept := models.Department{
		ID:   1,
		Name: "技术部",
	}
	db.Create(&dept)

	deptID := dept.ID
	user := models.User{
		ID:           1,
		EmployeeID:   "filter_user",
		Email:        "filter_user@example.com",
		Name:         "过滤测试用户",
		DepartmentID: &deptID,
	}
	db.Create(&user)

	repo1 := models.Repository{
		ID:           1,
		DepartmentID: 1,
		OwnerID:      1,
		Name:         "target-repo-1",
		URL:          "git@example.com:test/target-repo-1.git",
	}
	repo2 := models.Repository{
		ID:           2,
		DepartmentID: 1,
		OwnerID:      1,
		Name:         "other-repo-2",
		URL:          "git@example.com:test/other-repo-2.git",
	}
	db.Create(&repo1)
	db.Create(&repo2)

	// 3. 模拟 HTTP 请求，带有 ?name=target 过滤参数
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/api/repos?name=target", nil)
	ctx.Request = req

	// 4. 执行 GetRepos
	GetRepos(ctx)

	// 5. 校验返回值
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Items []models.Repository `json:"items"`
		Total int64               `json:"total"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}

	// 应当只返回名称匹配 "target" 的仓库 1，而不返回仓库 2
	if resp.Total != 1 {
		t.Errorf("expected total items to be 1, but got %d", resp.Total)
	}
	if len(resp.Items) != 1 || resp.Items[0].Name != "target-repo-1" {
		t.Errorf("expected returned repo name to be 'target-repo-1', but got %v", resp.Items)
	}
}

func TestImportReposWithoutRepoName(t *testing.T) {
	// 1. 初始化测试数据库
	db := setupTestDB(t)

	// 启动 Mock CodeHub 服务
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		resp := map[string]interface{}{
			"id":               10001,
			"ssh_url_to_repo":  "git@example.com:" + path + ".git",
			"http_url_to_repo": "https://example.com/" + path + ".git",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()
	models.AppConfig.Sync.RepoDetailURL = mockServer.URL

	// 2. 初始化一些基础数据
	dept := models.Department{
		ID:   1,
		Name: "技术部",
	}
	db.Create(&dept)

	deptID := dept.ID
	admin := models.User{
		ID:           1,
		EmployeeID:   "admin",
		Email:        "admin@code-shield.com",
		Name:         "管理员",
		DepartmentID: &deptID,
	}
	db.Create(&admin)

	// 3. 构建包含空代码仓列和有效田主的导入 CSV，测试带端口号的 RepoURL
	csvContentA := "RepoURL,田主,分支,部门名称,子系统\n" +
		"git@example.com:2222/test/auto-parse-repo-a.git,admin,master,技术部,code-bench\n"

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "test_a.csv")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	part.Write([]byte(csvContentA))
	writer.Close()

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("POST", "/repos/import", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request = req

	ImportRepos(ctx)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
	}

	var importedRepo models.Repository
	if err := db.Where("url = ?", "git@example.com:test/auto-parse-repo-a.git").First(&importedRepo).Error; err != nil {
		t.Fatalf("failed to find imported repo: %v", err)
	}

	expectedName := "test/auto-parse-repo-a"
	if importedRepo.Name != expectedName {
		t.Errorf("expected repo name to be %q, got %q", expectedName, importedRepo.Name)
	}

	// 额外校验：ProjectID & HTTPURL 是否正确填充
	if importedRepo.ProjectID != "10001" {
		t.Errorf("expected ProjectID to be '10001', got %s", importedRepo.ProjectID)
	}
	expectedHTTPURL := "https://example.com/test/auto-parse-repo-a.git"
	if importedRepo.HTTPURL != expectedHTTPURL {
		t.Errorf("expected HTTPURL to be %q, got %q", expectedHTTPURL, importedRepo.HTTPURL)
	}
}

func TestImportReposWithDefaultDepartment(t *testing.T) {
	// 1. 初始化测试数据库
	db := setupTestDB(t)

	// 启动 Mock CodeHub 服务
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		resp := map[string]interface{}{
			"id":               10001,
			"ssh_url_to_repo":  "git@example.com:" + path + ".git",
			"http_url_to_repo": "https://example.com/" + path + ".git",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()
	models.AppConfig.Sync.RepoDetailURL = mockServer.URL

	// 创建一个部门
	dept := models.Department{
		ID:   2,
		Name: "研发部",
	}
	db.Create(&dept)

	// 创建一个属于该部门的用户
	deptID := dept.ID
	admin := models.User{
		ID:           2,
		EmployeeID:   "admin2",
		Email:        "admin2@code-shield.com",
		Name:         "管理员2",
		DepartmentID: &deptID,
	}
	db.Create(&admin)

	// 3. 构建包含空部门名称的导入 CSV
	csvContent := "RepoURL,田主,分支,子系统\n" +
		"git@example.com:test/auto-dept-repo.git,admin2,master,code-bench\n"

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "test_dept.csv")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	part.Write([]byte(csvContent))
	writer.Close()

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("POST", "/repos/import", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request = req

	ImportRepos(ctx)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
	}

	var importedRepo models.Repository
	if err := db.Where("url = ?", "git@example.com:test/auto-dept-repo.git").First(&importedRepo).Error; err != nil {
		t.Fatalf("failed to find imported repo: %v", err)
	}

	// 验证该仓库是否被归入田主所属的部门 "研发部" (ID = 2)
	if importedRepo.DepartmentID != dept.ID {
		t.Errorf("expected DepartmentID to be %d, got %d", dept.ID, importedRepo.DepartmentID)
	}

	// 额外校验：ProjectID & HTTPURL 是否正确填充
	if importedRepo.ProjectID != "10001" {
		t.Errorf("expected ProjectID to be '10001', got %s", importedRepo.ProjectID)
	}
	expectedHTTPURL := "https://example.com/test/auto-dept-repo.git"
	if importedRepo.HTTPURL != expectedHTTPURL {
		t.Errorf("expected HTTPURL to be %q, got %q", expectedHTTPURL, importedRepo.HTTPURL)
	}
}

func TestGetReposFilterDepartmentAndOwner(t *testing.T) {
	db := setupTestDB(t)

	deptID := uint(37)
	dept := models.Department{
		ID:   37,
		Name: "业务部",
	}
	db.Create(&dept)

	user := models.User{
		ID:           1,
		Name:         "wangzhongyu",
		EmployeeID:   "1001",
		Email:        "wangzhongyu@example.com",
		DepartmentID: &deptID,
	}
	db.Create(&user)

	repo := models.Repository{
		ID:           1,
		DepartmentID: 37,
		Name:         "test-dept-owner-repo",
		URL:          "git@example.com:test/repo.git",
		OwnerID:      1,
	}
	db.Create(&repo)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/api/repos?department_id=37&owner=wangzhongyu", nil)
	ctx.Request = req

	GetRepos(ctx)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Items []models.Repository `json:"items"`
		Total int64               `json:"total"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}

	if resp.Total != 1 {
		t.Errorf("expected total items to be 1, but got %d", resp.Total)
	}
}

func TestImportReposWithNonExistentDepartmentFallback(t *testing.T) {
	// 1. 初始化测试数据库
	db := setupTestDB(t)

	// 启动 Mock CodeHub 服务
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		resp := map[string]interface{}{
			"id":               10001,
			"ssh_url_to_repo":  "git@example.com:" + path + ".git",
			"http_url_to_repo": "https://example.com/" + path + ".git",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()
	models.AppConfig.Sync.RepoDetailURL = mockServer.URL

	// 2. 创建真实存在的部门（研发中心）
	dept := models.Department{
		ID:   10,
		Name: "研发中心",
	}
	db.Create(&dept)

	// 创建田主用户并绑定到“研发中心”
	deptID := dept.ID
	user := models.User{
		ID:           10,
		EmployeeID:   "dev_lead",
		Email:        "dev_lead@example.com",
		Name:         "开发组长",
		DepartmentID: &deptID,
	}
	db.Create(&user)

	// 3. 构建 CSV，故意指定一个系统不存在的部门名称（"不存在的部门ABC"）
	csvContent := "RepoURL,田主,分支,部门名称,子系统\n" +
		"git@example.com:test/fallback-dept-repo.git,dev_lead,master,不存在的部门ABC,code-bench\n"

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "test_fallback.csv")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	part.Write([]byte(csvContent))
	writer.Close()

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("POST", "/repos/import", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request = req

	ImportRepos(ctx)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
	}

	// 4. 验证是否没有新建“不存在的部门ABC”
	var nonexistentDept models.Department
	if err := db.Where("name = ?", "不存在的部门ABC").First(&nonexistentDept).Error; err == nil {
		t.Errorf("expected '不存在的部门ABC' to NOT be created in database, but it was created!")
	}

	// 5. 验证仓库是否成功录入并回退到了田主所在的“研发中心” (ID = 10)
	var importedRepo models.Repository
	if err := db.Where("name = ?", "test/fallback-dept-repo").First(&importedRepo).Error; err != nil {
		t.Fatalf("failed to find imported repo: %v", err)
	}

	if importedRepo.DepartmentID != 10 {
		t.Errorf("expected DepartmentID to be 10 (owner's dept), got %d", importedRepo.DepartmentID)
	}
}

func TestCreateRepoInvalidBranch(t *testing.T) {
	db := setupTestDB(t)

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"id":               10002,
			"ssh_url_to_repo":  "git@example.com:test/invalid-branch-repo.git",
			"http_url_to_repo": "https://example.com/test/invalid-branch-repo.git",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()
	models.AppConfig.Sync.RepoDetailURL = mockServer.URL

	dept := models.Department{ID: 1, Name: "测试部"}
	db.Create(&dept)

	user := models.User{ID: 1, EmployeeID: "user1", Email: "u1@example.com", Name: "用户1"}
	db.Create(&user)

	// 测试带中文的分支
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)

	payload := `{"name":"invalid-branch-repo","url":"git@example.com:test/invalid-branch-repo.git","branch":"主分支master","department_id":1,"owner_id":1}`
	req, _ := http.NewRequest("POST", "/repos", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req

	CreateRepo(ctx)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for Chinese branch name, got %d", w.Code)
	}

	var count int64
	db.Model(&models.Repository{}).Where("name = ?", "invalid-branch-repo").Count(&count)
	if count != 0 {
		t.Errorf("expected repository to NOT be created in database, but got count %d", count)
	}
}

func TestUpdateRepoInvalidBranch(t *testing.T) {
	db := setupTestDB(t)

	dept := models.Department{ID: 1, Name: "测试部"}
	db.Create(&dept)

	user := models.User{ID: 1, EmployeeID: "user1", Email: "u1@example.com", Name: "用户1"}
	db.Create(&user)

	repo := models.Repository{
		ID:           1,
		DepartmentID: 1,
		OwnerID:      1,
		Name:         "valid-repo",
		URL:          "git@example.com:test/valid-repo.git",
		Branch:       "master",
	}
	db.Create(&repo)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Params = gin.Params{{Key: "id", Value: "1"}}

	payload := `{"branch":"非法..分支"}`
	req, _ := http.NewRequest("PATCH", "/repos/1", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req

	UpdateRepo(ctx)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for invalid branch in UpdateRepo, got %d", w.Code)
	}

	var checkRepo models.Repository
	db.First(&checkRepo, 1)
	if checkRepo.Branch != "master" {
		t.Errorf("expected branch to remain 'master', got %q", checkRepo.Branch)
	}
}

func TestImportReposInvalidBranchFallback(t *testing.T) {
	db := setupTestDB(t)

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		id := 10003
		if strings.Contains(path, "2") {
			id = 10004
		}
		resp := map[string]interface{}{
			"id":               id,
			"ssh_url_to_repo":  "git@example.com:" + path + ".git",
			"http_url_to_repo": "https://example.com/" + path + ".git",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()
	models.AppConfig.Sync.RepoDetailURL = mockServer.URL

	dept := models.Department{ID: 1, Name: "技术部"}
	db.Create(&dept)

	deptID := dept.ID
	user := models.User{
		ID:           1,
		EmployeeID:   "admin_branch",
		Email:        "admin_branch@example.com",
		Name:         "分支管理员",
		DepartmentID: &deptID,
	}
	db.Create(&user)

	// CSV 中包含中文分支 “开发分支” 和非法符号分支 “/invalid//branch”
	csvContent := "RepoURL,田主,分支,部门名称,子系统\n" +
		"git@example.com:test/branch-fallback-1.git,admin_branch,开发分支,技术部,code-bench\n" +
		"git@example.com:test/branch-fallback-2.git,admin_branch,/invalid//branch,技术部,code-bench\n"

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "test_branch_fallback.csv")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	part.Write([]byte(csvContent))
	writer.Close()

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("POST", "/repos/import", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request = req

	ImportRepos(ctx)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
	}

	var repo1 models.Repository
	if err := db.Where("name = ?", "test/branch-fallback-1").First(&repo1).Error; err != nil {
		t.Fatalf("failed to find repo1: %v", err)
	}
	if repo1.Branch != "master" {
		t.Errorf("expected repo1 branch to fallback to 'master', got %q", repo1.Branch)
	}

	var repo2 models.Repository
	if err := db.Where("name = ?", "test/branch-fallback-2").First(&repo2).Error; err != nil {
		t.Fatalf("failed to find repo2: %v", err)
	}
	if repo2.Branch != "master" {
		t.Errorf("expected repo2 branch to fallback to 'master', got %q", repo2.Branch)
	}
}

func TestImportReposSubsystemInvalidFallbackToURL(t *testing.T) {
	db := setupTestDB(t)

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		resp := map[string]interface{}{
			"id":               10004,
			"ssh_url_to_repo":  "git@example.com:" + path + ".git",
			"http_url_to_repo": "https://example.com/" + path + ".git",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()
	models.AppConfig.Sync.RepoDetailURL = mockServer.URL

	dept := models.Department{ID: 1, Name: "技术部"}
	db.Create(&dept)

	deptID := dept.ID
	user := models.User{
		ID:           1,
		EmployeeID:   "admin_subsys",
		Email:        "admin_subsys@example.com",
		Name:         "子系统管理员",
		DepartmentID: &deptID,
	}
	db.Create(&user)

	// 创建已有的架构子系统 "order-service"
	archElem := models.ArchitectureElement{
		ID:         5,
		Identifier: "order-service",
		NameCn:     "订单服务",
		NameEn:     "Order Service",
		Type:       "subsystem",
	}
	db.Create(&archElem)

	// CSV 中填写的子系统为“不存在的乱码子系统”，但 URL 路径包含 order-service
	csvContent := "RepoURL,田主,分支,部门名称,子系统\n" +
		"git@example.com:group/order-service/order-core.git,admin_subsys,master,技术部,不存在的乱码子系统\n"

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "test_subsys_fallback.csv")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	part.Write([]byte(csvContent))
	writer.Close()

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("POST", "/repos/import", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request = req

	ImportRepos(ctx)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
	}

	var imported models.Repository
	if err := db.Where("name = ?", "group/order-service/order-core").First(&imported).Error; err != nil {
		t.Fatalf("failed to find imported repo: %v", err)
	}

	if imported.ServiceGroup != "order-service" {
		t.Errorf("expected ServiceGroup to be 'order-service' (URL match), got %q", imported.ServiceGroup)
	}

	var updatedArch models.ArchitectureElement
	db.First(&updatedArch, 5)
	if updatedArch.RepoID == nil || *updatedArch.RepoID != imported.ID {
		t.Errorf("expected ArchitectureElement to be linked to repo ID %d, got %v", imported.ID, updatedArch.RepoID)
	}
}

func TestImportReposSubsystemInvalidAndURLNoMatchRejected(t *testing.T) {
	db := setupTestDB(t)

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		resp := map[string]interface{}{
			"id":               10005,
			"ssh_url_to_repo":  "git@example.com:" + path + ".git",
			"http_url_to_repo": "https://example.com/" + path + ".git",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()
	models.AppConfig.Sync.RepoDetailURL = mockServer.URL

	dept := models.Department{ID: 1, Name: "技术部"}
	db.Create(&dept)

	deptID := dept.ID
	user := models.User{
		ID:           1,
		EmployeeID:   "admin_subsys2",
		Email:        "admin_subsys2@example.com",
		Name:         "子系统管理员2",
		DepartmentID: &deptID,
	}
	db.Create(&user)

	// CSV 中填写的子系统为“未知系统”，且 URL 中所有路径段在架构中均不存在
	csvContent := "RepoURL,田主,分支,部门名称,子系统\n" +
		"git@example.com:unknown_group/unknown_subsys/unknown_repo.git,admin_subsys2,master,技术部,未知系统\n"

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "test_subsys_rejected.csv")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	part.Write([]byte(csvContent))
	writer.Close()

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("POST", "/repos/import", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request = req

	ImportRepos(ctx)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
	}

	// 验证该仓库被拒绝导入（数据库中未创建）
	var count int64
	db.Model(&models.Repository{}).Where("name = ?", "unknown_group/unknown_subsys/unknown_repo").Count(&count)
	if count != 0 {
		t.Errorf("expected repo to be rejected/skipped, but found in database! count: %d", count)
	}
}

func TestCreateRepoRejectDuplicate(t *testing.T) {
	db := setupTestDB(t)

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		resp := map[string]interface{}{
			"id":               10006,
			"ssh_url_to_repo":  "git@example.com:" + path + ".git",
			"http_url_to_repo": "https://example.com/" + path + ".git",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()
	models.AppConfig.Sync.RepoDetailURL = mockServer.URL

	dept := models.Department{ID: 1, Name: "测试部"}
	db.Create(&dept)

	user := models.User{ID: 1, EmployeeID: "user_dup", Email: "user_dup@example.com", Name: "防重测试用户"}
	db.Create(&user)

	// 预先插入已有仓库
	existing := models.Repository{
		ID:           1,
		DepartmentID: 1,
		OwnerID:      1,
		Name:         "repo-unique-name",
		URL:          "git@example.com:test/repo-unique.git",
		HTTPURL:      "https://example.com/test/repo-unique.git",
		ProjectID:    "10006",
		Branch:       "master",
	}
	db.Create(&existing)

	// 1. 测试同名冲突
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	payload1 := `{"name":"repo-unique-name","url":"git@example.com:test/other-url.git","branch":"master","department_id":1,"owner_id":1}`
	req1, _ := http.NewRequest("POST", "/repos", strings.NewReader(payload1))
	req1.Header.Set("Content-Type", "application/json")
	ctx.Request = req1

	CreateRepo(ctx)

	if w.Code != http.StatusConflict {
		t.Errorf("expected status 409 for duplicate repo name, got %d, body: %s", w.Code, w.Body.String())
	}

	// 2. 测试同 URL / ProjectID 冲突（即使名称不同）
	w2 := httptest.NewRecorder()
	ctx2, _ := gin.CreateTestContext(w2)
	payload2 := `{"name":"different-name","url":"git@example.com:test/repo-unique.git","branch":"master","department_id":1,"owner_id":1}`
	req2, _ := http.NewRequest("POST", "/repos", strings.NewReader(payload2))
	req2.Header.Set("Content-Type", "application/json")
	ctx2.Request = req2

	CreateRepo(ctx2)

	if w2.Code != http.StatusConflict {
		t.Errorf("expected status 409 for duplicate repo URL, got %d, body: %s", w2.Code, w2.Body.String())
	}
}

func TestUpdateRepoRejectDuplicate(t *testing.T) {
	db := setupTestDB(t)

	dept := models.Department{ID: 1, Name: "测试部"}
	db.Create(&dept)

	user := models.User{ID: 1, EmployeeID: "user_upd", Email: "user_upd@example.com", Name: "更新测试用户"}
	db.Create(&user)

	repo1 := models.Repository{
		ID:           1,
		DepartmentID: 1,
		OwnerID:      1,
		Name:         "repo-one",
		URL:          "git@example.com:test/repo-one.git",
		Branch:       "master",
	}
	repo2 := models.Repository{
		ID:           2,
		DepartmentID: 1,
		OwnerID:      1,
		Name:         "repo-two",
		URL:          "git@example.com:test/repo-two.git",
		Branch:       "master",
	}
	db.Create(&repo1)
	db.Create(&repo2)

	defer func() {
		db.Exec("DELETE FROM repositories WHERE id IN (1, 2)")
		db.Exec("DELETE FROM users WHERE id = 1 AND employee_id = 'user_upd'")
	}()

	// 尝试将 repo2 的名称修改为已存在的 repo1 名称
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Params = gin.Params{{Key: "id", Value: "2"}}

	payload := `{"name":"repo-one"}`
	req, _ := http.NewRequest("PATCH", "/repos/2", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req

	UpdateRepo(ctx)

	if w.Code != http.StatusConflict {
		t.Errorf("expected status 409 when updating to an existing repo name, got %d, body: %s", w.Code, w.Body.String())
	}
}
