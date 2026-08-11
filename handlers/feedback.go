package handlers

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"code-bench/database"
	"code-bench/models"

	"github.com/gin-gonic/gin"
)

// UploadFeedbackImage 处理贴图上传并保存至服务器本地目录
func UploadFeedbackImage(c *gin.Context) {
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "上传图片文件不能为空: " + err.Error()})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "仅支持 JPG, PNG, GIF, WEBP 格式图片"})
		return
	}

	// 限制文件大小为 10MB
	if file.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "单张图片大小不能超过 10MB"})
		return
	}

	uploadDir := "./uploads/feedback"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建文件保存目录失败"})
		return
	}

	// 生成安全唯一文件名
	filename := fmt.Sprintf("%d_%d%s", time.Now().UnixNano(), rand.Intn(100000), ext)
	savePath := filepath.Join(uploadDir, filename)

	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存贴图文件失败: " + err.Error()})
		return
	}

	imageURL := fmt.Sprintf("/uploads/feedback/%s", filename)
	c.JSON(http.StatusOK, gin.H{
		"url":     imageURL,
		"name":    file.Filename,
		"size":    file.Size,
		"message": "图片上传成功",
	})
}

// CreateFeedback 提交改进建议反馈
func CreateFeedback(c *gin.Context) {
	var req struct {
		Category string `json:"category"`
		Module   string `json:"module" binding:"required"`
		Priority string `json:"priority"`
		Title    string `json:"title" binding:"required"`
		Content  string `json:"content" binding:"required"`
		Images   any    `json:"images"` // 支持字符串或字符串数组
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数无效: " + err.Error()})
		return
	}

	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户未登录"})
		return
	}
	userID, ok := userIDVal.(uint)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "登录凭证异常"})
		return
	}

	// 基础文本校验 (根据需求，标题至少5个字符，建议内容至少10个字符)
	titleLen := utf8.RuneCountInString(req.Title)
	contentLen := utf8.RuneCountInString(req.Content)

	if titleLen < 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "反馈标题过短，至少需要5个字符"})
		return
	}
	if contentLen < 10 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "反馈建议详情过短，至少需要10个字符以描述细节"})
		return
	}

	category := req.Category
	if category == "" {
		category = "feature"
	}

	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}

	// 处理图片数组格式化存储
	imagesJSON := ""
	if req.Images != nil {
		switch v := req.Images.(type) {
		case string:
			imagesJSON = v
		case []any:
			var imgUrls []string
			for _, item := range v {
				if str, ok := item.(string); ok && str != "" {
					imgUrls = append(imgUrls, str)
				}
			}
			bytes, _ := json.Marshal(imgUrls)
			imagesJSON = string(bytes)
		}
	}

	feedback := models.Feedback{
		UserID:   userID,
		Category: category,
		Module:   req.Module,
		Priority: priority,
		Title:    req.Title,
		Content:  req.Content,
		Images:   imagesJSON,
		Status:   "pending", // 默认为待处理
	}

	if err := database.DB.Create(&feedback).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存反馈建议失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "感谢您的宝贵建议，反馈已提报成功！",
		"id":      feedback.ID,
	})
}

// GetFeedbacks 获取反馈历史列表
func GetFeedbacks(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	category := c.Query("category")
	module := c.Query("module")
	priority := c.Query("priority")
	q := c.Query("q")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户未登录"})
		return
	}
	userID := userIDVal.(uint)

	userVal, exists := c.Get("user")
	canManage := false
	if exists {
		if user, ok := userVal.(models.User); ok && user.HasRole("bench_admin") {
			canManage = true
		}
	}

	query := database.DB.Model(&models.Feedback{})

	// 权限过滤：非管理员只能查自己的提报
	if !canManage {
		query = query.Where("user_id = ?", userID)
	} else {
		// 管理员可以按特定提报人过滤
		filterUserIDStr := c.Query("user_id")
		if filterUserIDStr != "" {
			if filterUserID, err := strconv.Atoi(filterUserIDStr); err == nil && filterUserID > 0 {
				query = query.Where("user_id = ?", filterUserID)
			}
		}
	}

	// 按分类筛选
	if category != "" {
		query = query.Where("category = ?", category)
	}

	// 按模块筛选
	if module != "" {
		query = query.Where("module = ?", module)
	}

	// 按优先级筛选
	if priority != "" {
		query = query.Where("priority = ?", priority)
	}

	// 关键词搜索 (标题或内容)
	if q != "" {
		query = query.Where("title LIKE ? OR content LIKE ?", "%"+q+"%", "%"+q+"%")
	}

	// 按状态筛选
	status := c.Query("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// 排除特定状态
	excludeStatus := c.Query("excludeStatus")
	if excludeStatus != "" {
		query = query.Where("status != ?", excludeStatus)
	}

	var total int64
	query.Count(&total)

	var list []models.Feedback
	offset := (page - 1) * pageSize
	if err := query.Preload("User").Order("created_at desc").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询反馈失败"})
		return
	}

	// 为普通用户隐藏 User 表的高危敏感信息 (如密码)
	for i := range list {
		if list[i].User != nil {
			list[i].User.Password = ""
		}
	}

	totalPages := 0
	if total > 0 {
		totalPages = int((total + int64(pageSize) - 1) / int64(pageSize))
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      list,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": totalPages,
	})
}

// UpdateFeedback 管理员回复并处理反馈建议
func UpdateFeedback(c *gin.Context) {
	userVal, exists := c.Get("user")
	canManage := false
	if exists {
		if user, ok := userVal.(models.User); ok && user.HasRole("bench_admin") {
			canManage = true
		}
	}
	if !canManage {
		c.JSON(http.StatusForbidden, gin.H{"error": "权限不足，仅管理员可回复反馈"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的反馈ID"})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
		Reply  string `json:"reply"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数无效: " + err.Error()})
		return
	}

	// 状态值合法性校验
	validStatuses := map[string]bool{
		"pending":    true,
		"processing": true,
		"resolved":   true,
		"rejected":   true,
	}
	if !validStatuses[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不支持的反馈状态值"})
		return
	}

	var feedback models.Feedback
	if err := database.DB.First(&feedback, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "反馈建议未找到"})
		return
	}

	feedback.Status = req.Status
	feedback.Reply = req.Reply

	if err := database.DB.Save(&feedback).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新反馈状态失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "反馈更新成功",
	})
}
