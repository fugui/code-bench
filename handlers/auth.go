package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	commonAudit "code-common/backend/audit"
	commonAuth "code-common/backend/auth"
	commonModels "code-common/backend/models"

	"code-bench/database"
	"code-bench/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type Claims = commonAuth.PortalClaims

func getJWTSecret() []byte {
	return []byte(models.AppConfig.Auth.JWTSecret)
}

func GenerateToken(user models.User) (string, error) {
	secret := getJWTSecret()
	expirationTime := time.Now().Add(6 * time.Hour)

	username := user.Email
	if username == "" {
		username = user.Name
	}

	claims := &Claims{
		UserID:     user.ID,
		Username:   username,
		Email:      user.Email,
		Name:       user.Name,
		EmployeeID: user.EmployeeID,
		Roles:      user.GetRoles(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

func ParseToken(tokenString string) (*Claims, error) {
	return commonAuth.ParseToken(tokenString, models.AppConfig.Auth.JWTSecret)
}

func Login(c *gin.Context) {
	if !models.AppConfig.Auth.PasswordLoginEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "Password login is disabled"})
		return
	}

	var req struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	var user models.User
	if err := database.DB.Preload("Department").Where("LOWER(email) = LOWER(?)", cleanEmail).First(&user).Error; err != nil {
		commonAudit.SetAuditContext(c, "auth", "login", commonModels.AuditLevelP2,
			fmt.Sprintf("用户登录失败: 尝试账号 [%s], 用户不存在", cleanEmail),
			"user", "", cleanEmail, nil, nil)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !user.IsActive {
		commonAudit.SetAuditContext(c, "auth", "login", commonModels.AuditLevelP2,
			fmt.Sprintf("用户登录失败: 尝试账号 [%s], 账号已被禁用", cleanEmail),
			"user", fmt.Sprintf("%d", user.ID), user.Name, nil, nil)
		c.JSON(http.StatusForbidden, gin.H{"error": "Account is inactive"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		commonAudit.SetAuditContext(c, "auth", "login", commonModels.AuditLevelP2,
			fmt.Sprintf("用户登录失败: 尝试账号 [%s], 密码错误", cleanEmail),
			"user", fmt.Sprintf("%d", user.ID), user.Name, nil, nil)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := GenerateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	now := time.Now()
	clientIP := c.ClientIP()
	database.DB.Model(&user).Updates(map[string]interface{}{
		"last_login": now,
		"last_ip":    clientIP,
	})
	user.LastLogin = &now
	user.LastIP = clientIP

	// 注入标准化用户上下文及审计上下文
	deptName := ""
	if user.Department != nil {
		deptName = user.Department.Name
	}
	displayName := user.Name
	if displayName == "" {
		displayName = user.Email
	}

	commonAuth.SetUserContext(c, &commonAuth.UserContext{
		UserID:         user.ID,
		Username:       user.Email,
		Name:           user.Name,
		Email:          user.Email,
		EmployeeID:     user.EmployeeID,
		Roles:          user.GetRoles(),
		DepartmentID:   user.DepartmentID,
		DepartmentName: deptName,
	})

	commonAudit.SetAuditContext(c, "auth", "login", commonModels.AuditLevelP2,
		fmt.Sprintf("用户 [%s] 登录系统成功 (IP: %s)", displayName, clientIP),
		"user", fmt.Sprintf("%d", user.ID), displayName, nil, nil)

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  user,
	})
}

func GetMe(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User context missing"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func UpdatePassword(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID missing"})
		return
	}

	var req struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.OldPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Incorrect current password"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	if err := database.DB.Model(&user).Update("password", string(hashed)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	displayName := user.Name
	if displayName == "" {
		displayName = user.Email
	}
	commonAudit.SetAuditContext(c, "auth", "update_password", commonModels.AuditLevelP1,
		fmt.Sprintf("用户 [%s] 修改个人密码成功", displayName),
		"user", fmt.Sprintf("%d", user.ID), displayName, nil, nil)

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}

func GetMyDepartmentProxy(c *gin.Context) {
	deptURL := models.AppConfig.Auth.OAuth2.DeptAPIURL
	if deptURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dept_api_url is not configured"})
		return
	}

	// 1. 创建发往外部接口的请求
	req, err := http.NewRequest("GET", deptURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create proxy request"})
		return
	}

	// 2. 将前端发来的所有 Cookie 透传过去
	for _, cookie := range c.Request.Cookies() {
		req.AddCookie(cookie)
	}

	// 3. 执行请求
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to reach department API: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	// 4. 将 Response Header 里的特殊网关头部透传发回前端（如网关暴露的 x-login-url 等）
	for k, vv := range resp.Header {
		if strings.HasPrefix(strings.ToLower(k), "x-login") {
			for _, v := range vv {
				c.Header(k, v)
			}
		}
	}

	// 5. 将结果直接透传回给前端
	c.DataFromReader(resp.StatusCode, resp.ContentLength, resp.Header.Get("Content-Type"), resp.Body, nil)
}
