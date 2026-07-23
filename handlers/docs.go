package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"code-bench/models"

	"github.com/gin-gonic/gin"
)

type DocNode struct {
	Name     string    `json:"name"`
	Path     string    `json:"path"` // Relative path from docs root
	IsDir    bool      `json:"is_dir"`
	Children []DocNode `json:"children,omitempty"`
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

	c.JSON(http.StatusOK, gin.H{
		"tree":       nodes,
		"configured": true,
	})
}

// GetDocContent handles GET /api/docs/content?path=...
func GetDocContent(c *gin.Context) {
	relPath := strings.TrimSpace(c.Query("path"))
	if relPath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求路径 (path) 不能为空"})
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

	c.JSON(http.StatusOK, gin.H{
		"path":     relPath,
		"name":     info.Name(),
		"content":  string(contentBytes),
		"mod_time": info.ModTime().Format(time.RFC3339),
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
				nodes = append(nodes, DocNode{
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
