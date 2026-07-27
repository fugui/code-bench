package handlers

import (
	"crypto/md5"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"code-bench/database"
	"code-bench/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type DocNode struct {
	ID           string    `json:"id,omitempty"`
	Name         string    `json:"name"`
	Path         string    `json:"path"` // Relative path from docs root
	IsDir        bool      `json:"is_dir"`
	Views        int64     `json:"views"`
	CommentCount int64     `json:"comment_count"`
	Children     []DocNode `json:"children,omitempty"`
}

var (
	docMapMutex sync.RWMutex
	docIDToPath = make(map[string]string)
	docPathToID = make(map[string]string)
)

// GenerateDocID returns an 8-character hex string based on the MD5 of relPath
func GenerateDocID(relPath string) string {
	h := md5.Sum([]byte(relPath))
	return fmt.Sprintf("%x", h)[:8]
}

func registerDocID(relPath string) string {
	id := GenerateDocID(relPath)
	docMapMutex.Lock()
	docIDToPath[id] = relPath
	docPathToID[relPath] = id
	docMapMutex.Unlock()
	return id
}

func getPathByDocID(id string) string {
	docMapMutex.RLock()
	defer docMapMutex.RUnlock()
	return docIDToPath[id]
}

// GetDocsTree handles GET /api/docs/tree
func GetDocsTree(c *gin.Context) {
	docsRoot := strings.TrimSpace(models.AppConfig.Docs.Path)
	if docsRoot == "" {
		c.JSON(http.StatusOK, gin.H{
			"tree":       []DocNode{},
			"configured": false,
			"message":    "文档仓库路径未配置，请在 config.yaml 中配置 docs.path",
		})
		return
	}

	cleanRoot := filepath.Clean(docsRoot)
	info, err := os.Stat(cleanRoot)
	if err != nil || !info.IsDir() {
		c.JSON(http.StatusOK, gin.H{
			"tree":       []DocNode{},
			"configured": false,
			"message":    fmt.Sprintf("配置的文档路径无效或不存在: %s", cleanRoot),
		})
		return
	}

	nodes, err := scanDocDir(cleanRoot, cleanRoot)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取文档树失败: " + err.Error()})
		return
	}

	// Fetch statistics (views and comment counts) from database
	var stats []models.DocStat
	database.DB.Find(&stats)
	viewsMap := make(map[string]int64)
	for _, s := range stats {
		viewsMap[s.DocPath] = s.Views
	}

	type CommentCountResult struct {
		DocPath string `gorm:"column:doc_path"`
		Count   int64  `gorm:"column:count"`
	}
	var commentCounts []CommentCountResult
	database.DB.Model(&models.DocComment{}).
		Select("doc_path, count(*) as count").
		Where("status = ?", "active").
		Group("doc_path").
		Scan(&commentCounts)

	commentsMap := make(map[string]int64)
	for _, cc := range commentCounts {
		commentsMap[cc.DocPath] = cc.Count
	}

	// Attach stats to tree nodes recursively
	populateNodeStats(nodes, viewsMap, commentsMap)

	c.JSON(http.StatusOK, gin.H{
		"tree":       nodes,
		"configured": true,
	})
}

func populateNodeStats(nodes []DocNode, viewsMap map[string]int64, commentsMap map[string]int64) {
	for i := range nodes {
		if nodes[i].IsDir {
			if len(nodes[i].Children) > 0 {
				populateNodeStats(nodes[i].Children, viewsMap, commentsMap)
			}
		} else {
			nodes[i].Views = viewsMap[nodes[i].Path]
			nodes[i].CommentCount = commentsMap[nodes[i].Path]
		}
	}
}

// GetDocContent handles GET /api/docs/content?path=... or ?id=...
func GetDocContent(c *gin.Context) {
	relPath := strings.TrimSpace(c.Query("path"))
	docID := strings.TrimSpace(c.Query("id"))

	if relPath == "" && docID != "" {
		relPath = getPathByDocID(docID)
		if relPath == "" {
			// Refresh tree scan once if not found
			docsRoot := strings.TrimSpace(models.AppConfig.Docs.Path)
			if docsRoot != "" {
				cleanRoot := filepath.Clean(docsRoot)
				if _, err := os.Stat(cleanRoot); err == nil {
					_, _ = scanDocDir(cleanRoot, cleanRoot)
					relPath = getPathByDocID(docID)
				}
			}
		}
	}

	if relPath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求路径 (path) 或文档 ID (id) 不能为空或找不到对应文档"})
		return
	}

	docsRoot := strings.TrimSpace(models.AppConfig.Docs.Path)
	if docsRoot == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文档仓库路径未配置"})
		return
	}

	cleanRoot := filepath.Clean(docsRoot)
	fullPath := filepath.Clean(filepath.Join(cleanRoot, relPath))

	// Path Traversal Protection
	rel, err := filepath.Rel(cleanRoot, fullPath)
	if err != nil || strings.HasPrefix(rel, "..") || strings.HasPrefix(rel, "/") {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权访问此路径"})
		return
	}

	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "文档不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取文档信息失败: " + err.Error()})
		return
	}

	if info.IsDir() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "目标路径为目录而非文档"})
		return
	}

	contentBytes, err := os.ReadFile(fullPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取文档内容失败: " + err.Error()})
		return
	}

	// Increment document reading count
	var stat models.DocStat
	if err := database.DB.Where("doc_path = ?", relPath).First(&stat).Error; err != nil {
		stat = models.DocStat{
			DocPath:   relPath,
			Views:     1,
			UpdatedAt: time.Now(),
		}
		database.DB.Create(&stat)
	} else {
		database.DB.Model(&stat).UpdateColumn("views", gorm.Expr("views + ?", 1))
		stat.Views++
	}

	// Fetch active comment count for this doc
	var commentCount int64
	database.DB.Model(&models.DocComment{}).
		Where("doc_path = ? AND status = ?", relPath, "active").
		Count(&commentCount)

	docID = registerDocID(relPath)
	c.JSON(http.StatusOK, gin.H{
		"id":            docID,
		"path":          relPath,
		"name":          info.Name(),
		"content":       string(contentBytes),
		"mod_time":      info.ModTime().Format(time.RFC3339),
		"views":         stat.Views,
		"comment_count": commentCount,
	})
}

// GetDocComments handles GET /api/docs/comments?path=...
func GetDocComments(c *gin.Context) {
	relPath := strings.TrimSpace(c.Query("path"))
	if relPath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求路径 (path) 不能为空"})
		return
	}

	var comments []models.DocComment
	err := database.DB.Preload("User").
		Where("doc_path = ? AND status = ?", relPath, "active").
		Order("created_at asc").
		Find(&comments).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取文档评论失败: " + err.Error()})
		return
	}

	// Hide sensitive password field in User preloads
	for i := range comments {
		if comments[i].User != nil {
			comments[i].User.Password = ""
		}
	}

	// Structure into nested parent-child replies tree
	commentMap := make(map[uint]*models.DocComment)
	var topLevelComments []*models.DocComment

	for i := range comments {
		cRef := &comments[i]
		cRef.Replies = []*models.DocComment{}
		commentMap[cRef.ID] = cRef
	}

	for i := range comments {
		cRef := &comments[i]
		if cRef.ParentID != nil && *cRef.ParentID > 0 {
			if parent, ok := commentMap[*cRef.ParentID]; ok {
				parent.Replies = append(parent.Replies, cRef)
			} else {
				topLevelComments = append(topLevelComments, cRef)
			}
		} else {
			topLevelComments = append(topLevelComments, cRef)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"comments": topLevelComments,
		"total":    len(comments),
	})
}

// CreateDocComment handles POST /api/docs/comments
func CreateDocComment(c *gin.Context) {
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

	var req struct {
		Path     string `json:"path" binding:"required"`
		ParentID *uint  `json:"parent_id"`
		Content  string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数无效: " + err.Error()})
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "评论内容不能为空"})
		return
	}

	// If parent_id specified, check parent comment validity
	if req.ParentID != nil && *req.ParentID > 0 {
		var parent models.DocComment
		if err := database.DB.First(&parent, *req.ParentID).Error; err != nil || parent.Status != "active" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "回复的父评论不存在或已被删除"})
			return
		}
	}

	comment := models.DocComment{
		DocPath:  req.Path,
		UserID:   userID,
		ParentID: req.ParentID,
		Content:  content,
		Status:   "active",
	}

	if err := database.DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "提交评论失败: " + err.Error()})
		return
	}

	// Preload User for response
	database.DB.Preload("User").First(&comment, comment.ID)
	if comment.User != nil {
		comment.User.Password = ""
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "评论发表成功",
		"comment": comment,
	})
}

// DeleteDocComment handles DELETE /api/docs/comments/:id
func DeleteDocComment(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户未登录"})
		return
	}
	userID := userIDVal.(uint)

	userVal, exists := c.Get("user")
	isSuperAdmin := false
	if exists {
		if user, ok := userVal.(models.User); ok && user.IsSuperAdmin() {
			isSuperAdmin = true
		}
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的评论ID"})
		return
	}

	var comment models.DocComment
	if err := database.DB.First(&comment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "评论未找到"})
		return
	}

	if comment.UserID != userID && !isSuperAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权删除此评论"})
		return
	}

	comment.Status = "deleted"
	if err := database.DB.Save(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除评论失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "评论已成功删除",
	})
}

// scanDocDir recursively scans directory for markdown files
func scanDocDir(currentDir string, rootDir string) ([]DocNode, error) {
	entries, err := os.ReadDir(currentDir)
	if err != nil {
		return nil, err
	}

	var nodes []DocNode

	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, ".") || strings.HasPrefix(name, "_") {
			continue
		}

		fullPath := filepath.Join(currentDir, name)
		relPath, err := filepath.Rel(rootDir, fullPath)
		if err != nil {
			continue
		}
		// Standardize path separator to forward slash for frontend matching
		relPath = filepath.ToSlash(relPath)

		if entry.IsDir() {
			children, err := scanDocDir(fullPath, rootDir)
			if err != nil {
				continue
			}
			// Only include directories that have valid markdown children
			if len(children) > 0 {
				nodes = append(nodes, DocNode{
					Name:     name,
					Path:     relPath,
					IsDir:    true,
					Children: children,
				})
			}
		} else {
			ext := strings.ToLower(filepath.Ext(name))
			if ext == ".md" || ext == ".markdown" {
				docID := registerDocID(relPath)
				nodes = append(nodes, DocNode{
					ID:    docID,
					Name:  name,
					Path:  relPath,
					IsDir: false,
				})
			}
		}
	}

	// Sort nodes: directories first, then files, sorted alphabetically
	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].IsDir != nodes[j].IsDir {
			return nodes[i].IsDir
		}
		return nodes[i].Name < nodes[j].Name
	})

	return nodes, nil
}
