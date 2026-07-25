package handlers

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"unicode/utf8"

	"code-bench/database"
	"code-bench/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
	"gorm.io/datatypes"
)

func GetUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "15"))
	search := c.Query("search")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 15
	}
	if pageSize > 1000 {
		pageSize = 1000
	}

	query := database.DB.Model(&models.User{})

	if search != "" {
		query = query.Joins("LEFT JOIN departments ON users.department_id = departments.id").
			Where("users.name LIKE ? OR users.email LIKE ? OR users.employee_id LIKE ? OR departments.name LIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	deptIDStr := c.Query("department_id")
	if deptIDStr != "" {
		if deptID, err := strconv.Atoi(deptIDStr); err == nil && deptID > 0 {
			query = query.Where("users.department_id = ?", deptID)
		}
	}

	idStr := c.Query("id")
	if idStr != "" {
		if id, err := strconv.Atoi(idStr); err == nil && id > 0 {
			query = query.Where("users.id = ?", id)
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count users"})
		return
	}

	sortBy := c.Query("sort_by")
	order := strings.ToUpper(c.Query("order"))
	if order != "ASC" && order != "DESC" {
		order = "DESC"
	}

	orderExpr := "users.last_login DESC NULLS LAST, users.created_at DESC"
	switch sortBy {
	case "email":
		orderExpr = fmt.Sprintf("users.email %s", order)
	case "employee_id":
		orderExpr = fmt.Sprintf("users.employee_id %s NULLS LAST", order)
	case "roles":
		orderExpr = fmt.Sprintf("(CASE WHEN users.roles::text LIKE '%%super_admin%%' THEN 5 WHEN users.roles::text LIKE '%%bench_admin%%' THEN 4 WHEN users.roles::text LIKE '%%pipeline_admin%%' THEN 3 WHEN users.roles::text LIKE '%%shield_admin%%' THEN 2 WHEN users.roles::text LIKE '%%pdm_admin%%' THEN 1 ELSE 0 END) %s, users.created_at DESC", order)
	case "last_login":
		orderExpr = fmt.Sprintf("users.last_login %s NULLS LAST, users.created_at DESC", order)
	case "is_active":
		orderExpr = fmt.Sprintf("users.is_active %s, users.created_at DESC", order)
	case "created_at":
		orderExpr = fmt.Sprintf("users.created_at %s", order)
	case "name":
		orderExpr = fmt.Sprintf("users.name %s", order)
	}

	var users []models.User
	offset := (page - 1) * pageSize
	if err := query.Preload("Department").Order(orderExpr).Offset(offset).Limit(pageSize).Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	for i := range users {
		users[i].Password = ""
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))

	c.JSON(http.StatusOK, gin.H{
		"items":      users,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": totalPages,
	})
}

func CreateUser(c *gin.Context) {
	var req struct {
		Email        string   `json:"email" binding:"required"`
		Name         string   `json:"name" binding:"required"`
		Password     string   `json:"password" binding:"required"`
		EmployeeID   string   `json:"employee_id"`
		UniqueID     string   `json:"unique_id"`
		EmployeeType string   `json:"employee_type"`
		DepartmentID *uint    `json:"department_id"`
		Roles        []string `json:"roles"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.DepartmentID == nil || *req.DepartmentID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户必须选择归属部门"})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	if _, err := mail.ParseAddress(cleanEmail); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Login email must be a valid email address"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	var uniqueID *string
	if strings.TrimSpace(req.UniqueID) != "" {
		trimmed := strings.TrimSpace(req.UniqueID)
		uniqueID = &trimmed
	}

	var rolesJSON datatypes.JSON
	if len(req.Roles) > 0 {
		b, _ := json.Marshal(req.Roles)
		rolesJSON = datatypes.JSON(b)
	}

	user := models.User{
		Email:        cleanEmail,
		Name:         strings.TrimSpace(req.Name),
		Password:     string(hashed),
		EmployeeID:   strings.TrimSpace(req.EmployeeID),
		UniqueID:     uniqueID,
		EmployeeType: strings.TrimSpace(req.EmployeeType),
		DepartmentID: req.DepartmentID,
		RegMethod:    "local",
		IsActive:     true,
		Roles:        rolesJSON,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, user)
}

func UpdateUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Email        string    `json:"email"`
		Name         string    `json:"name"`
		Roles        *[]string `json:"roles"`
		Password     string    `json:"password"`
		EmployeeID   string    `json:"employee_id"`
		UniqueID     *string   `json:"unique_id"`
		EmployeeType string    `json:"employee_type"`
		DepartmentID *uint     `json:"department_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.DepartmentID != nil && *req.DepartmentID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户必须选择归属部门"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if req.Email != "" {
		cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
		if _, err := mail.ParseAddress(cleanEmail); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Login email must be a valid email address"})
			return
		}
		user.Email = cleanEmail
	}
	if req.Name != "" {
		user.Name = strings.TrimSpace(req.Name)
	}
	if req.Roles != nil {
		b, _ := json.Marshal(*req.Roles)
		user.Roles = datatypes.JSON(b)
	}
	if req.Password != "" {
		hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		user.Password = string(hashed)
	}
	if req.EmployeeID != "" {
		user.EmployeeID = strings.TrimSpace(req.EmployeeID)
	}
	if req.UniqueID != nil && strings.TrimSpace(*req.UniqueID) != "" {
		trimmed := strings.TrimSpace(*req.UniqueID)
		user.UniqueID = &trimmed
	}
	if req.EmployeeType != "" {
		user.EmployeeType = strings.TrimSpace(req.EmployeeType)
	}
	if req.DepartmentID != nil {
		user.DepartmentID = req.DepartmentID
	}

	if err := database.DB.Save(&user).Error; err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: users.email") || strings.Contains(err.Error(), "users.email") {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user: " + err.Error()})
		return
	}

	database.DB.Preload("Department").First(&user, user.ID)

	user.Password = ""
	c.JSON(http.StatusOK, user)
}

func UpdateUserStatus(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		IsActive bool `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.IsActive = req.IsActive
	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user status"})
		return
	}

	database.DB.Preload("Department").First(&user, user.ID)

	user.Password = ""
	c.JSON(http.StatusOK, user)
}

func DeleteUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if err := database.DB.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

func ExportUsers(c *gin.Context) {
	var users []models.User
	database.DB.Preload("Department").Order("name asc").Find(&users)

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=users.csv")

	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.Write([]string{"工号", "姓名", "部门", "邮箱", "激活状态", "注册方式", "角色", "创建时间"})
	for _, u := range users {
		deptName := ""
		if u.Department != nil {
			deptName = u.Department.Name
		}
		status := "禁用"
		if u.IsActive {
			status = "启用"
		}
		role := strings.Join(u.GetRoles(), ", ")
		if role == "" {
			role = "普通用户"
		}
		writer.Write([]string{
			u.EmployeeID,
			u.Name,
			deptName,
			u.Email,
			status,
			u.RegMethod,
			role,
			u.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}
}

func ImportUsers(c *gin.Context) {
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

	requiredHeaders := []string{"姓名", "邮箱"}
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

	placeholderPassword, _ := bcrypt.GenerateFromPassword([]byte("imported-account-no-local-password"), bcrypt.DefaultCost)

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

		name := getField("姓名")
		idStr := getField("工号")
		if idStr == "" {
			idStr = getField("ID")
		}
		email := getField("邮箱")
		deptName := getField("部门")

		if name == "" || email == "" {
			continue
		}

		var deptID *uint
		if deptName != "" {
			var dept models.Department
			if err := database.DB.Where("name = ?", deptName).First(&dept).Error; err != nil {
				dept = models.Department{
					Name: deptName,
				}
				if err := database.DB.Create(&dept).Error; err == nil {
					deptID = &dept.ID
				}
			} else {
				deptID = &dept.ID
			}
		}

		var user models.User
		if err := database.DB.Where("email = ?", email).First(&user).Error; err != nil {
			user = models.User{
				EmployeeID:   idStr,
				Name:         name,
				Email:        email,
				Password:     string(placeholderPassword),
				RegMethod:    "imported",
				IsActive:     false,
				DepartmentID: deptID,
			}
			if err := database.DB.Create(&user).Error; err == nil {
				successCount++
			}
		} else {
			user.Name = name
			if idStr != "" {
				user.EmployeeID = idStr
			}
			if deptID != nil {
				user.DepartmentID = deptID
			}
			if err := database.DB.Save(&user).Error; err == nil {
				successCount++
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Successfully imported/updated %d users", successCount)})
}
