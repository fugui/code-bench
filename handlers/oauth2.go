package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"code-bench/database"
	"code-bench/models"

	"github.com/gin-gonic/gin"
)

var oauth2States *StateStore

func init() {
	oauth2States = NewStateStore()
}

func GetAuthConfig(c *gin.Context) {
	authCfg := models.AppConfig.Auth
	c.JSON(http.StatusOK, gin.H{
		"oauth2_enabled":         authCfg.OAuth2.Enabled,
		"password_login_enabled": authCfg.PasswordLoginEnabled,
		"dept_api_url":           authCfg.OAuth2.DeptAPIURL,
	})
}

func StartOAuth2Flow(c *gin.Context) {
	oauth2Cfg := models.AppConfig.Auth.OAuth2
	if !oauth2Cfg.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "OAuth2 SSO is not enabled"})
		return
	}

	state, _, codeChallenge, err := oauth2States.GenerateState()
	if err != nil {
		log.Printf("[OAuth2] Failed to generate state: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initiate SSO login"})
		return
	}

	params := url.Values{
		"response_type":         {"code"},
		"client_id":             {oauth2Cfg.ClientID},
		"redirect_uri":          {oauth2Cfg.RedirectURL},
		"scope":                 {strings.Join(oauth2Cfg.Scopes, " ")},
		"state":                 {state},
		"code_challenge":        {codeChallenge},
		"code_challenge_method": {"S256"},
	}

	authURL := oauth2Cfg.AuthURL + "?" + params.Encode()
	c.Redirect(http.StatusFound, authURL)
}

func OAuth2Callback(c *gin.Context) {
	oauth2Cfg := models.AppConfig.Auth.OAuth2
	if !oauth2Cfg.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "OAuth2 SSO is not enabled"})
		return
	}

	if errMsg := c.Query("error"); errMsg != "" {
		errDesc := c.Query("error_description")
		log.Printf("[OAuth2] IdP returned error: %s - %s", errMsg, errDesc)
		redirectToLoginWithError(c, "SSO 登录失败: "+errDesc)
		return
	}

	code := c.Query("code")
	state := c.Query("state")
	if code == "" || state == "" {
		redirectToLoginWithError(c, "SSO 回调参数缺失")
		return
	}

	codeVerifier, ok := oauth2States.ValidateAndConsume(state)
	if !ok {
		redirectToLoginWithError(c, "SSO 登录超时或状态无效，请重试")
		return
	}

	tokenData, err := exchangeCodeForToken(oauth2Cfg, code, codeVerifier)
	if err != nil {
		log.Printf("[OAuth2] Token exchange failed: %v", err)
		redirectToLoginWithError(c, "SSO Token 交换失败")
		return
	}

	accessToken, _ := tokenData["access_token"].(string)
	if accessToken == "" {
		log.Printf("[OAuth2] No access_token in response: %v", tokenData)
		redirectToLoginWithError(c, "SSO 未返回有效的 access_token")
		return
	}

	userInfo, err := fetchUserInfo(oauth2Cfg.UserInfoURL, accessToken)
	if err != nil {
		log.Printf("[OAuth2] UserInfo fetch failed: %v", err)
		redirectToLoginWithError(c, "SSO 用户信息获取失败")
		return
	}

	mapping := oauth2Cfg.FieldMapping
	email := getStringField(userInfo, mapping.Email)
	rawUsername := getStringField(userInfo, mapping.Username)
	name := parseSSOAttribute(rawUsername)
	if customName := getStringField(userInfo, mapping.Name); customName != "" {
		name = customName
	}

	employeeID := getStringField(userInfo, mapping.EmployeeID)
	uniqueID := getStringField(userInfo, mapping.UniqueID)
	employeeType := getStringField(userInfo, mapping.EmployeeType)

	if email == "" {
		email = parseSSOEnglishName(rawUsername)
	}

	if email == "" {
		log.Printf("[OAuth2] No email/username found in userinfo: %v", userInfo)
		redirectToLoginWithError(c, "SSO 未返回用户邮箱或标识信息")
		return
	}

	// 校验邮箱后缀白名单
	if len(oauth2Cfg.AllowedEmailDomains) > 0 {
		allowed := false
		emailLower := strings.ToLower(email)
		for _, domain := range oauth2Cfg.AllowedEmailDomains {
			domain = strings.ToLower(strings.TrimSpace(domain))
			if domain == "" {
				continue
			}
			if !strings.HasPrefix(domain, "@") {
				domain = "@" + domain
			}
			if strings.HasSuffix(emailLower, domain) {
				allowed = true
				break
			}
		}
		if !allowed {
			log.Printf("[OAuth2] Email domain not allowed: %s", email)
			logRejectedEmail(email)
			redirectToLoginWithError(c, "访问受限，请联系系统管理员。")
			return
		}
	}

	isAdmin := false
	for _, adminEmail := range oauth2Cfg.AdminList {
		if strings.EqualFold(strings.TrimSpace(adminEmail), strings.TrimSpace(email)) {
			isAdmin = true
			break
		}
	}

	var user models.User
	userFound := false

	if uniqueID != "" {
		if err := database.DB.Where("unique_id = ?", uniqueID).First(&user).Error; err == nil {
			userFound = true
		}
	}

	if !userFound && email != "" {
		if err := database.DB.Where("email = ?", email).First(&user).Error; err == nil {
			userFound = true
		}
	}

	if !userFound && employeeID != "" {
		if err := database.DB.Where("employee_id = ?", employeeID).First(&user).Error; err == nil {
			userFound = true
		}
	}

	if !userFound {
		displayName := name
		if displayName == "" {
			displayName = email
		}

		var uniqueIDPtr *string
		if uniqueID != "" {
			uniqueIDPtr = &uniqueID
		}

		user = models.User{
			Email:        email,
			Name:         displayName,
			EmployeeID:   employeeID,
			UniqueID:     uniqueIDPtr,
			EmployeeType: employeeType,
			RegMethod:    "sso",
			IsAdmin:      isAdmin,
			IsActive:     true,
			Password:     "$2a$10$SSO_USER_NO_PASSWORD_LOGIN",
		}
		if err := database.DB.Create(&user).Error; err != nil {
			log.Printf("[OAuth2] Failed to auto-provision user %s: %v", email, err)
			redirectToLoginWithError(c, "SSO 用户自动开通失败")
			return
		}
	} else {
		updates := map[string]interface{}{}
		if name != "" && name != user.Name {
			updates["name"] = name
			user.Name = name
		}
		if employeeID != "" && employeeID != user.EmployeeID {
			updates["employee_id"] = employeeID
			user.EmployeeID = employeeID
		}
		if uniqueID != "" && (user.UniqueID == nil || *user.UniqueID != uniqueID) {
			updates["unique_id"] = uniqueID
			user.UniqueID = &uniqueID
		}
		if employeeType != "" && employeeType != user.EmployeeType {
			updates["employee_type"] = employeeType
			user.EmployeeType = employeeType
		}
		if user.RegMethod == "imported" {
			updates["reg_method"] = "sso"
			user.RegMethod = "sso"
			updates["is_active"] = true
			user.IsActive = true
		}
		if !user.IsAdmin && isAdmin {
			updates["is_admin"] = true
			user.IsAdmin = true
		}
		if len(updates) > 0 {
			database.DB.Model(&user).Updates(updates)
		}
	}

	if !user.IsActive {
		redirectToLoginWithError(c, "该账号已被管理员禁用")
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

	// Generate local JWT token
	tokenString, err := GenerateToken(user)
	if err != nil {
		log.Printf("[OAuth2] Failed to generate JWT: %v", err)
		redirectToLoginWithError(c, "登录凭证生成失败")
		return
	}

	frontendCallbackURL := buildFrontendCallbackURL(tokenString, email)
	c.Redirect(http.StatusFound, frontendCallbackURL)
}

func exchangeCodeForToken(cfg models.OAuth2Config, code, codeVerifier string) (map[string]interface{}, error) {
	data := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {cfg.RedirectURL},
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"code_verifier": {codeVerifier},
	}

	resp, err := http.PostForm(cfg.TokenURL, data)
	if err != nil {
		return nil, fmt.Errorf("token request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token endpoint returned %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}

	return result, nil
}

func fetchUserInfo(userInfoURL, accessToken string) (map[string]interface{}, error) {
	oauth2Cfg := models.AppConfig.Auth.OAuth2

	requestBody, err := json.Marshal(map[string]string{
		"client_id":    oauth2Cfg.ClientID,
		"access_token": accessToken,
		"scope":        strings.Join(oauth2Cfg.Scopes, " "),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal userinfo request body: %w", err)
	}

	req, err := http.NewRequest("POST", userInfoURL, strings.NewReader(string(requestBody)))
	if err != nil {
		return nil, fmt.Errorf("failed to create userinfo request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("userinfo request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read userinfo response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo endpoint returned %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse userinfo response: %w", err)
	}

	return result, nil
}

func getStringField(data map[string]interface{}, key string) string {
	if val, ok := data[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

func parseSSOAttribute(val string) string {
	if val == "" {
		return ""
	}
	if idx := strings.Index(val, "cn="); idx != -1 {
		sub := val[idx+3:]
		if end := strings.IndexAny(sub, ", "); end != -1 {
			return sub[:end]
		}
		return sub
	}
	if idx := strings.Index(val, "en="); idx != -1 {
		sub := val[idx+3:]
		if end := strings.IndexAny(sub, ", "); end != -1 {
			return sub[:end]
		}
		return sub
	}
	return val
}

func parseSSOEnglishName(val string) string {
	if val == "" {
		return ""
	}
	if idx := strings.Index(val, "en="); idx != -1 {
		sub := val[idx+3:]
		if end := strings.IndexAny(sub, ", "); end != -1 {
			return sub[:end]
		}
		return sub
	}
	if idx := strings.Index(val, "cn="); idx != -1 {
		sub := val[idx+3:]
		if end := strings.IndexAny(sub, ", "); end != -1 {
			return sub[:end]
		}
		return sub
	}
	return val
}

func buildFrontendCallbackURL(token, email string) string {
	externalURL := strings.TrimRight(models.AppConfig.Server.ExternalURL, "/")
	// Note: redirect to portal's own callback route
	callbackPath := "/oauth2/callback"

	params := url.Values{
		"token": {token},
	}
	if email != "" {
		params.Set("email", email)
	}

	return externalURL + callbackPath + "?" + params.Encode()
}

func redirectToLoginWithError(c *gin.Context, errorMsg string) {
	externalURL := strings.TrimRight(models.AppConfig.Server.ExternalURL, "/")
	// Note: redirect back to portal login page with query param
	loginURL := externalURL + "/?sso_error=" + url.QueryEscape(errorMsg)
	c.Redirect(http.StatusFound, loginURL)
}

func logRejectedEmail(email string) {
	f, err := os.OpenFile("sso_reject.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Printf("[OAuth2] Failed to open sso_reject.log: %v", err)
		return
	}
	defer f.Close()

	logLine := fmt.Sprintf("%s - Rejected Email: %s\n", time.Now().Format(time.RFC3339), email)
	if _, err := f.WriteString(logLine); err != nil {
		log.Printf("[OAuth2] Failed to write to sso_reject.log: %v", err)
	}
}
