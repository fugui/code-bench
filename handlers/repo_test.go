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

	// 3. 构建包含空责任人和子系统的导入 CSV
	csvContent := "代码仓,RepoURL,田主,分支,部门名称,子系统\n" +
		"test-repo,git@example.com:test/test-repo.git,,master,技术部,code-bench\n"

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

	// 校验 Bug 1：空责任人未把原有的 OwnerID=1 覆盖为 0
	if updatedRepo.OwnerID != 1 {
		t.Errorf("expected OwnerID to remain 1, but got %d", updatedRepo.OwnerID)
	}

	// 校验架构元素关联：匹配到子系统 "code-bench" 并设置了双向关联
	var updatedArch models.ArchitectureElement
	if err := db.First(&updatedArch, 1).Error; err != nil {
		t.Fatalf("failed to find arch element: %v", err)
	}
	if updatedArch.RepoID == nil || *updatedArch.RepoID != 1 {
		t.Errorf("expected ArchElement.RepoID to be 1, but got %v", updatedArch.RepoID)
	}
}

func TestGetReposFilterName(t *testing.T) {
	// 1. 初始化测试数据库 (内存 sqlite)
	db, err := gorm.Open(sqlite.Open("file::memory2:?cache=shared"), &gorm.Config{})
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
