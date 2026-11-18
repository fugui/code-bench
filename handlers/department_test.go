package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"code-bench/models"

	"github.com/gin-gonic/gin"
)

func performUpdateMyDepartment(t *testing.T, userID *uint, payload string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/me/department", func(c *gin.Context) {
		if userID != nil {
			c.Set("userID", *userID)
		}
		UpdateMyDepartment(c)
	})

	req, err := http.NewRequest(http.MethodPost, "/api/me/department", bytes.NewBufferString(payload))
	if err != nil {
		t.Fatalf("failed to build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestUpdateMyDepartment_InitialAndSwitch(t *testing.T) {
	db := setupTestDB(t)
	if db == nil {
		return
	}

	user := models.User{
		Email:    "switch-dept@example.com",
		Name:     "张三",
		IsActive: true,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// 1. 首次无部门时自动创建并绑定部门
	w := performUpdateMyDepartment(t, &user.ID, `{"department":"平台研发部"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 on initial assign, got %d: %s", w.Code, w.Body.String())
	}

	var respUser models.User
	if err := json.Unmarshal(w.Body.Bytes(), &respUser); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if respUser.Department == nil || respUser.Department.Name != "平台研发部" {
		t.Fatalf("expected department '平台研发部', got %+v", respUser.Department)
	}
	firstDeptID := respUser.Department.ID

	// 2. 相同部门幂等调用不应更换或报错
	wSame := performUpdateMyDepartment(t, &user.ID, `{"department":" 平台研发部 "}`)
	if wSame.Code != http.StatusOK {
		t.Fatalf("expected 200 on idempotent sync, got %d: %s", wSame.Code, wSame.Body.String())
	}
	var sameResp models.User
	if err := json.Unmarshal(wSame.Body.Bytes(), &sameResp); err != nil {
		t.Fatalf("failed to decode idempotent response: %v", err)
	}
	if sameResp.DepartmentID == nil || *sameResp.DepartmentID != firstDeptID {
		t.Fatalf("expected department_id %d unchanged, got %v", firstDeptID, sameResp.DepartmentID)
	}

	// 3. 中途换部门到已存在的目标部门
	targetDept := models.Department{Name: "基础架构部"}
	if err := db.Create(&targetDept).Error; err != nil {
		t.Fatalf("failed to create target department: %v", err)
	}

	wSwitch := performUpdateMyDepartment(t, &user.ID, `{"department":"基础架构部"}`)
	if wSwitch.Code != http.StatusOK {
		t.Fatalf("expected 200 on department switch, got %d: %s", wSwitch.Code, wSwitch.Body.String())
	}
	var switchedUser models.User
	if err := json.Unmarshal(wSwitch.Body.Bytes(), &switchedUser); err != nil {
		t.Fatalf("failed to decode switch response: %v", err)
	}
	if switchedUser.DepartmentID == nil || *switchedUser.DepartmentID != targetDept.ID {
		t.Fatalf("expected department_id %d, got %v", targetDept.ID, switchedUser.DepartmentID)
	}
	if switchedUser.Department == nil || switchedUser.Department.Name != "基础架构部" {
		t.Fatalf("expected department '基础架构部', got %+v", switchedUser.Department)
	}

	// 确认数据库持久化成功
	var reloaded models.User
	if err := db.Preload("Department").First(&reloaded, user.ID).Error; err != nil {
		t.Fatalf("failed to reload user: %v", err)
	}
	if reloaded.DepartmentID == nil || *reloaded.DepartmentID != targetDept.ID {
		t.Fatalf("expected persisted department_id %d, got %v", targetDept.ID, reloaded.DepartmentID)
	}

	// 4. 换部门到尚未在数据库中建立的新部门，应自动创建并切换
	wNewSwitch := performUpdateMyDepartment(t, &user.ID, `{"department":"AI 效能部"}`)
	if wNewSwitch.Code != http.StatusOK {
		t.Fatalf("expected 200 on switch to new department, got %d: %s", wNewSwitch.Code, wNewSwitch.Body.String())
	}
	var newSwitched models.User
	if err := json.Unmarshal(wNewSwitch.Body.Bytes(), &newSwitched); err != nil {
		t.Fatalf("failed to decode new switch response: %v", err)
	}
	if newSwitched.Department == nil || newSwitched.Department.Name != "AI 效能部" {
		t.Fatalf("expected department 'AI 效能部', got %+v", newSwitched.Department)
	}
}

func TestUpdateMyDepartment_ValidationAndAuth(t *testing.T) {
	db := setupTestDB(t)
	if db == nil {
		return
	}

	// 缺少 userID 上下文 -> 401
	wNoAuth := performUpdateMyDepartment(t, nil, `{"department":"平台研发部"}`)
	if wNoAuth.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when userID missing, got %d", wNoAuth.Code)
	}

	user := models.User{
		Email:    "invalid-dept@example.com",
		Name:     "李四",
		IsActive: true,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// 空字符串 / 纯空格 -> 400
	wEmpty := performUpdateMyDepartment(t, &user.ID, `{"department":"   "}`)
	if wEmpty.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for whitespace department, got %d", wEmpty.Code)
	}

	// 不存在的 userID -> 404
	missingID := uint(999999)
	wNotFound := performUpdateMyDepartment(t, &missingID, `{"department":"平台研发部"}`)
	if wNotFound.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for missing user, got %d", wNotFound.Code)
	}
}
