package handlers

import (
	"code-bench/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetModules 返回当前已配置并激活的微前端模块列表
func GetModules(c *gin.Context) {
	modules := models.GetActiveModules()
	c.JSON(http.StatusOK, gin.H{
		"modules": modules,
	})
}
