package handlers

import (
	"net/http"
	"strconv"
	"unicode/utf8"

	"code-bench/database"
	"code-bench/models"

	"github.com/gin-gonic/gin"
)

// CreateFeedback 提交改进建议反馈
func CreateFeedback(c *gin.Context) {
	var req struct {
		Module  string `json:"module" binding:"required"`
		Title   string `json:"title" binding:"required"`
		Content string `json:"content" binding:"required"`
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

	feedback := models.Feedback{
		UserID:  userID,
		Module:  req.Module,
		Title:   req.Title,
		Content: req.Content,
		Status:  "pending", // 默认为待处理
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
	module := c.Query("module")

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

	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)

	query := database.DB.Model(&models.Feedback{})

	// 权限过滤：非管理员只能查自己的提报
	if !isAdmin {
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

	// 按模块筛选
	if module != "" {
		query = query.Where("module = ?", module)
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
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "统计历史反馈失败"})
		return
	}

	var feedbacks []models.Feedback
	offset := (page - 1) * pageSize
	if err := query.Preload("User").Order("created_at desc").Offset(offset).Limit(pageSize).Find(&feedbacks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取历史反馈列表失败"})
		return
	}

	// 为普通用户隐藏 User 表的高危敏感信息 (如密码)
	for i := range feedbacks {
		if feedbacks[i].User != nil {
			feedbacks[i].User.Password = ""
		}
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	if totalPages < 1 {
		totalPages = 1
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      feedbacks,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": totalPages,
	})
}

// UpdateFeedback 管理员回复并处理反馈建议
func UpdateFeedback(c *gin.Context) {
	isAdminVal, _ := c.Get("isAdmin")
	isAdmin, _ := isAdminVal.(bool)
	if !isAdmin {
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
