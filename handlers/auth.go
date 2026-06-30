package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"code-bench/database"
	"code-bench/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type Claims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	IsAdmin  bool   `json:"is_admin"`
	jwt.RegisteredClaims
}

func getJWTSecret() []byte {
	return []byte(models.AppConfig.Auth.JWTSecret)
}

func GenerateToken(user models.User) (string, error) {
	secret := getJWTSecret()
	expirationTime := time.Now().Add(24 * time.Hour)

	username := user.Email
	if username == "" {
		username = user.Name
	}

	claims := &Claims{
		UserID:   user.ID,
		Username: username,
		Email:    user.Email,
		Name:     user.Name,
		IsAdmin:  user.IsAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

func ParseToken(tokenString string) (*Claims, error) {
	secret := getJWTSecret()
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header missing"})
			c.Abort()
			return
		}

		if len(tokenString) > 7 && strings.HasPrefix(tokenString, "Bearer ") {
			tokenString = tokenString[7:]
		}

		claims, err := ParseToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		var user models.User
		if err := database.DB.Preload("Department").First(&user, claims.UserID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			c.Abort()
			return
		}

		if !user.IsActive {
			c.JSON(http.StatusForbidden, gin.H{"error": "Account is inactive"})
			c.Abort()
			return
		}

		c.Set("userID", user.ID)
		c.Set("username", user.Email)
		c.Set("email", user.Email)
		c.Set("isAdmin", user.IsAdmin)
		c.Set("user", user)
		c.Next()
	}
}

func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		isAdminVal, exists := c.Get("isAdmin")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}
		isAdmin, ok := isAdminVal.(bool)
		if !ok || !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin privileges required"})
			c.Abort()
			return
		}
		c.Next()
	}
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

	var user models.User
	if err := database.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "Account is inactive"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
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
