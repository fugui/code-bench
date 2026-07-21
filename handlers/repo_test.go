package handlers

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"code-bench/database"
	"code-bench/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestImportRepos(t *testing.T) {
	// 1. 初始化测试数据库 (内存 sqlite)
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	db.AutoMigrate(&models.User{}, &models.Department{}, &models.Repository{}, &models.ArchitectureElement{})
	database.DB = db

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
	// 创建一个用户做责任人
	admin := models.User{
		ID:         1,
		EmployeeID: "admin",
		Email:      "admin@code-shield.com",
		Name:       "管理员",
	}
	db.Create(&admin)

	// 创建一个架构元素，类型为 subsystem，英文标识符为 code-bench
	archElem := models.ArchitectureElement{
		ID:         1,
		Identifier: "code-bench",
		NameCn:     "代码度量",
		NameEn:     "Code Bench",
		Type:       "subsystem",
	}
	db.Create(&archElem)

	// 创建一个已有仓库，OwnerID = 1
	oldRepo := models.Repository{
		ID:           1,
		DepartmentID: 1,
		Name:         "test-repo",
		URL:          "git@example.com:test/test-repo.git",
		OwnerID:      1,
		Branch:       "master",
		IsActive:     true,
	}
	db.Create(&oldRepo)

	// 3. 构建包含田主和子系统的导入 CSV
	csvContent := "代码仓,RepoURL,田主,分支,部门名称,子系统\n" +
		"test-repo,git@example.com:test/test-repo.git,admin,master,技术部,code-bench\n"

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

	var updatedRepo models.Repository
	if err := db.First(&updatedRepo, 1).Error; err != nil {
		t.Fatalf("failed to find repo: %v", err)
	}

	// 校验责任人更新为对应用户 ID (1)
	if updatedRepo.OwnerID != 1 {
		t.Errorf("expected OwnerID to be 1, but got %d", updatedRepo.OwnerID)
	}

	// 校验架构元素关联：匹配到子系统 "code-bench" 并设置了双向关联
	var updatedArch models.ArchitectureElement
	if err := db.First(&updatedArch, 1).Error; err != nil {
		t.Fatalf("failed to find arch element: %v", err)
	}
	if updatedArch.RepoID == nil || *updatedArch.RepoID != 1 {
		t.Errorf("expected ArchElement.RepoID to be 1, but got %v", updatedArch.RepoID)
	}

	// 额外校验：ProjectID & HTTPURL 是否正确填充
	if updatedRepo.ProjectID != "10001" {
		t.Errorf("expected ProjectID to be '10001', got %s", updatedRepo.ProjectID)
	}
	expectedHTTPURL := "https://example.com/test/test-repo.git"
	if updatedRepo.HTTPURL != expectedHTTPURL {
		t.Errorf("expected HTTPURL to be %q, got %q", expectedHTTPURL, updatedRepo.HTTPURL)
	}
}

func TestGetReposFilterName(t *testing.T) {
	// 1. 初始化测试数据库 (内存 sqlite)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	db.AutoMigrate(&models.Repository{})
	database.DB = db

	// 2. 插入测试仓库
	repo1 := models.Repository{
		ID:           1,
		DepartmentID: 1,
		Name:         "target-repo-1",
		URL:          "git@example.com:test/target-repo-1.git",
	}
	repo2 := models.Repository{
		ID:           2,
		DepartmentID: 1,
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
	// 1. 初始化测试数据库 (内存 sqlite)
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	db.AutoMigrate(&models.User{}, &models.Department{}, &models.Repository{}, &models.ArchitectureElement{})
	database.DB = db

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
	admin := models.User{
		ID:         1,
		EmployeeID: "admin",
		Email:      "admin@code-shield.com",
		Name:       "管理员",
	}
	db.Create(&admin)

	// 3. 构建包含空代码仓列和有效田主的导入 CSV
	csvContentA := "RepoURL,田主,分支,部门名称,子系统\n" +
		"git@example.com:test/auto-parse-repo-a.git,admin,master,技术部,code-bench\n"

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
	// 1. 初始化测试数据库 (内存 sqlite)
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	db.AutoMigrate(&models.User{}, &models.Department{}, &models.Repository{}, &models.ArchitectureElement{})
	database.DB = db

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

