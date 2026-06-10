package handlers

import (
	"net/http"
	"strconv"

	"code-bench/database"
	"code-bench/models"

	"github.com/gin-gonic/gin"
)

// GetArchElements returns all architecture elements
func GetArchElements(c *gin.Context) {
	var elements []models.ArchitectureElement
	if err := database.DB.Preload("Repo").Preload("Owner").Find(&elements).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch architecture elements: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, elements)
}

// CreateArchElement creates a new architecture element
func CreateArchElement(c *gin.Context) {
	var element models.ArchitectureElement
	if err := c.ShouldBindJSON(&element); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Basic validation
	if element.Identifier == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "标识名称不能为空"})
		return
	}
	if element.NameCn == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "中文名称不能为空"})
		return
	}
	if element.NameEn == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "英文名称不能为空"})
		return
	}
	if element.Type != "subsystem" && element.Type != "group" && element.Type != "module" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的节点类型"})
		return
	}

	// If parent ID is provided, verify it exists
	if element.ParentID != nil {
		var parent models.ArchitectureElement
		if err := database.DB.First(&parent, *element.ParentID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "父级架构元素不存在"})
			return
		}
	}

	// If owner ID is provided, verify it exists
	if element.OwnerID != nil {
		var owner models.User
		if err := database.DB.First(&owner, *element.OwnerID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "所选责任人不存在"})
			return
		}
	}

	// If repo ID is provided, verify it exists
	if element.RepoID != nil {
		var repo models.Repository
		if err := database.DB.First(&repo, *element.RepoID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "关联代码仓不存在"})
			return
		}
	}

	if err := database.DB.Create(&element).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建架构元素失败: " + err.Error()})
		return
	}

	// Reload with associations
	if err := database.DB.Preload("Repo").Preload("Owner").First(&element, element.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取新增架构元素失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, element)
}

// UpdateArchElement updates an architecture element
func UpdateArchElement(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID格式"})
		return
	}

	var element models.ArchitectureElement
	if err := database.DB.First(&element, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "架构元素不存在"})
		return
	}

	var input struct {
		Identifier   *string `json:"identifier"`
		NameCn       *string `json:"name_cn"`
		NameEn       *string `json:"name_en"`
		Type         *string `json:"type"`
		ParentID     **uint  `json:"parent_id"`
		OwnerID      **uint  `json:"owner_id"`
		RepoID       **uint  `json:"repo_id"`
		Subdirectory *string `json:"subdirectory"`
		Description  *string `json:"description"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}

	if input.Identifier != nil {
		if *input.Identifier == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "标识名称不能为空"})
			return
		}
		updates["identifier"] = *input.Identifier
	}
	if input.NameCn != nil {
		if *input.NameCn == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "中文名称不能为空"})
			return
		}
		updates["name_cn"] = *input.NameCn
	}
	if input.NameEn != nil {
		if *input.NameEn == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "英文名称不能为空"})
			return
		}
		updates["name_en"] = *input.NameEn
	}
	if input.Type != nil {
		if *input.Type != "subsystem" && *input.Type != "group" && *input.Type != "module" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的节点类型"})
			return
		}
		updates["type"] = *input.Type
	}
	if input.ParentID != nil {
		if *input.ParentID == nil {
			updates["parent_id"] = nil
		} else {
			newParentID := **input.ParentID
			if newParentID == uint(id) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "架构元素不能将自身设置为父节点"})
				return
			}
			// Verify parent exists
			var parent models.ArchitectureElement
			if err := database.DB.First(&parent, newParentID).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "设置的父级架构元素不存在"})
				return
			}
			// Check cycle
			if isDescendantOf(newParentID, uint(id)) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "检测到循环引用：父节点不能是该节点自身的子孙节点"})
				return
			}
			updates["parent_id"] = newParentID
		}
	}
	if input.OwnerID != nil {
		if *input.OwnerID == nil {
			updates["owner_id"] = nil
		} else {
			newOwnerID := **input.OwnerID
			var owner models.User
			if err := database.DB.First(&owner, newOwnerID).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "所选责任人不存在"})
				return
			}
			updates["owner_id"] = newOwnerID
		}
	}
	if input.RepoID != nil {
		if *input.RepoID == nil {
			updates["repo_id"] = nil
		} else {
			newRepoID := **input.RepoID
			var repo models.Repository
			if err := database.DB.First(&repo, newRepoID).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "关联代码仓不存在"})
				return
			}
			updates["repo_id"] = newRepoID
		}
	}
	if input.Subdirectory != nil {
		updates["subdirectory"] = *input.Subdirectory
	}
	if input.Description != nil {
		updates["description"] = *input.Description
	}

	if len(updates) > 0 {
		if err := database.DB.Model(&element).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "更新架构元素失败: " + err.Error()})
			return
		}
	}

	// Reload with associations
	if err := database.DB.Preload("Repo").Preload("Owner").First(&element, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取更新后的架构元素失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, element)
}

// DeleteArchElement deletes an architecture element
func DeleteArchElement(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID格式"})
		return
	}

	// Check if this node has any children
	var count int64
	if err := database.DB.Model(&models.ArchitectureElement{}).Where("parent_id = ?", id).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询子架构元素失败: " + err.Error()})
		return
	}
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法删除：该节点下存在子架构元素"})
		return
	}

	if err := database.DB.Delete(&models.ArchitectureElement{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除架构元素失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "架构元素删除成功"})
}

// isDescendantOf helper to check if nodeID is a descendant of potentialAncestorID
func isDescendantOf(nodeID uint, potentialAncestorID uint) bool {
	currID := nodeID
	for {
		var node models.ArchitectureElement
		if err := database.DB.Select("parent_id").First(&node, currID).Error; err != nil {
			return false
		}
		if node.ParentID == nil {
			return false
		}
		if *node.ParentID == potentialAncestorID {
			return true
		}
		currID = *node.ParentID
	}
}
