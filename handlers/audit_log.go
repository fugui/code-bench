package handlers

import (
	"bytes"
	"code-bench/database"
	"code-bench/models"
	commonAudit "code-common/backend/audit"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetAuditLogs 查询全局操作审计日志列表（支持多维筛选与分页）
func GetAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "25"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 25
	}

	query := database.DB.Model(&models.SysAuditLog{})

	// 1. 筛选条件
	if service := c.Query("service"); service != "" {
		query = query.Where("service = ?", service)
	}
	if level := c.Query("level"); level != "" {
		query = query.Where("level = ?", level)
	}
	if module := c.Query("module"); module != "" {
		query = query.Where("module = ?", module)
	}
	if action := c.Query("action"); action != "" {
		query = query.Where("action = ?", action)
	}
	if status := c.Query("status"); status != "" {
		if s, err := strconv.Atoi(status); err == nil {
			query = query.Where("status_code = ?", s)
		}
	}
	if traceID := c.Query("trace_id"); traceID != "" {
		query = query.Where("trace_id = ?", traceID)
	}
	if operator := c.Query("operator"); operator != "" {
		query = query.Where("username LIKE ?", "%"+operator+"%")
	}
	if search := c.Query("search"); search != "" {
		query = query.Where("summary LIKE ? OR target_name LIKE ? OR target_id LIKE ? OR request_path LIKE ? OR client_ip LIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}
	if startTime := c.Query("start_time"); startTime != "" {
		if t, err := time.Parse(time.RFC3339, startTime); err == nil {
			query = query.Where("created_at >= ?", t)
		} else if t, err := time.Parse("2006-01-02 15:04:05", startTime); err == nil {
			query = query.Where("created_at >= ?", t)
		} else if t, err := time.Parse("2006-01-02", startTime); err == nil {
			query = query.Where("created_at >= ?", t)
		}
	}
	if endTime := c.Query("end_time"); endTime != "" {
		if t, err := time.Parse(time.RFC3339, endTime); err == nil {
			query = query.Where("created_at <= ?", t)
		} else if t, err := time.Parse("2006-01-02 15:04:05", endTime); err == nil {
			query = query.Where("created_at <= ?", t)
		} else if t, err := time.Parse("2006-01-02", endTime); err == nil {
			query = query.Where("created_at <= ?", t.Add(24*time.Hour-time.Nanosecond))
		}
	}

	// 2. 总数计算
	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取审计日志总数失败: " + err.Error()})
		return
	}

	// 3. 分页查询
	var logs []models.SysAuditLog
	offset := (page - 1) * pageSize
	if err := query.Order("id DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取审计日志列表失败: " + err.Error()})
		return
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))

	c.JSON(http.StatusOK, gin.H{
		"items":      logs,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": totalPages,
	})
}

// GetAuditLogDetail 获取单条审计日志详细
func GetAuditLogDetail(c *gin.Context) {
	id := c.Param("id")
	var log models.SysAuditLog
	if err := database.DB.First(&log, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "审计日志未找到"})
		return
	}
	c.JSON(http.StatusOK, log)
}

// GetAuditLogStats 获取操作审计全局与今日概览统计
func GetAuditLogStats(c *gin.Context) {
	var totalCount int64
	var todayCount int64
	var p0Count int64
	var p1Count int64
	var p2Count int64

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	database.DB.Model(&models.SysAuditLog{}).Count(&totalCount)
	database.DB.Model(&models.SysAuditLog{}).Where("created_at >= ?", todayStart).Count(&todayCount)
	database.DB.Model(&models.SysAuditLog{}).Where("level = ?", models.AuditLevelP0).Count(&p0Count)
	database.DB.Model(&models.SysAuditLog{}).Where("level = ?", models.AuditLevelP1).Count(&p1Count)
	database.DB.Model(&models.SysAuditLog{}).Where("level = ?", models.AuditLevelP2).Count(&p2Count)

	c.JSON(http.StatusOK, gin.H{
		"total_logs": totalCount,
		"today_logs": todayCount,
		"p0_count":   p0Count,
		"p1_count":   p1Count,
		"p2_count":   p2Count,
	})
}

// ClearAuditLogs 根据保留天数清理历史审计日志（强制 days > 0 并留存 P0 自审计记录）
func ClearAuditLogs(c *gin.Context) {
	var req struct {
		Days int `json:"days" form:"days"`
	}
	if err := c.ShouldBind(&req); err != nil || req.Days <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供有效的大于 0 的保留天数参数 (days)"})
		return
	}

	cutoffTime := time.Now().AddDate(0, 0, -req.Days)

	var deletedCount int64
	res := database.DB.Where("created_at < ?", cutoffTime).Delete(&models.SysAuditLog{})
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "清理历史审计日志失败: " + res.Error.Error()})
		return
	}
	deletedCount = res.RowsAffected

	// 强制注入自身清理操作的 P0 级自审计日志
	commonAudit.SetAuditContext(
		c,
		"audit",
		"clean",
		models.AuditLevelP0,
		fmt.Sprintf("管理员清理了 %d 天前的操作审计日志，共物理删除 %d 条记录", req.Days, deletedCount),
		"sys_audit_logs",
		fmt.Sprintf("days_%d", req.Days),
		"全局系统审计日志库",
		map[string]interface{}{"retention_days": req.Days, "cutoff_time": cutoffTime.Format("2006-01-02 15:04:05")},
		map[string]interface{}{"deleted_count": deletedCount},
	)

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("成功清理 %d 天前的历史审计日志，共删除 %d 条", req.Days, deletedCount),
		"deleted": deletedCount,
	})
}

// ExportAuditLogs 导出操作审计日志为 CSV 格式（带 UTF-8 BOM）
func ExportAuditLogs(c *gin.Context) {
	query := database.DB.Model(&models.SysAuditLog{})

	if service := c.Query("service"); service != "" {
		query = query.Where("service = ?", service)
	}
	if module := c.Query("module"); module != "" {
		query = query.Where("module = ?", module)
	}
	if level := c.Query("level"); level != "" {
		query = query.Where("level = ?", level)
	}
	if action := c.Query("action"); action != "" {
		query = query.Where("action = ?", action)
	}
	if status := c.Query("status"); status != "" {
		if s, err := strconv.Atoi(status); err == nil {
			query = query.Where("status_code = ?", s)
		}
	}
	if traceID := c.Query("trace_id"); traceID != "" {
		query = query.Where("trace_id = ?", traceID)
	}
	if operator := c.Query("operator"); operator != "" {
		query = query.Where("username LIKE ?", "%"+operator+"%")
	}
	if search := c.Query("search"); search != "" {
		query = query.Where("summary LIKE ? OR target_name LIKE ? OR target_id LIKE ? OR request_path LIKE ? OR client_ip LIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}
	if startTime := c.Query("start_time"); startTime != "" {
		if t, err := time.Parse(time.RFC3339, startTime); err == nil {
			query = query.Where("created_at >= ?", t)
		} else if t, err := time.Parse("2006-01-02 15:04:05", startTime); err == nil {
			query = query.Where("created_at >= ?", t)
		} else if t, err := time.Parse("2006-01-02", startTime); err == nil {
			query = query.Where("created_at >= ?", t)
		}
	}
	if endTime := c.Query("end_time"); endTime != "" {
		if t, err := time.Parse(time.RFC3339, endTime); err == nil {
			query = query.Where("created_at <= ?", t)
		} else if t, err := time.Parse("2006-01-02 15:04:05", endTime); err == nil {
			query = query.Where("created_at <= ?", t)
		} else if t, err := time.Parse("2006-01-02", endTime); err == nil {
			query = query.Where("created_at <= ?", t.Add(24*time.Hour-time.Nanosecond))
		}
	}

	var logs []models.SysAuditLog
	if err := query.Order("id DESC").Limit(5000).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询待导出数据失败: " + err.Error()})
		return
	}

	buf := &bytes.Buffer{}
	// 写入 UTF-8 BOM
	buf.WriteString("\xEF\xBB\xBF")

	writer := csv.NewWriter(buf)
	// Header
	_ = writer.Write([]string{
		"ID", "追踪ID (TraceID)", "微服务", "操作模块", "动作类型", "风险等级",
		"操作人账号", "操作人角色", "操作摘要", "目标类型", "目标标识", "目标名称",
		"请求路径", "HTTP方法", "状态码", "耗时(ms)", "客户端IP", "操作时间",
	})

	for _, l := range logs {
		_ = writer.Write([]string{
			fmt.Sprintf("%d", l.ID),
			l.TraceID,
			l.Service,
			l.Module,
			l.Action,
			string(l.Level),
			l.Username,
			l.UserRole,
			l.Summary,
			l.TargetType,
			l.TargetID,
			l.TargetName,
			l.RequestPath,
			l.RequestMethod,
			fmt.Sprintf("%d", l.StatusCode),
			fmt.Sprintf("%d", l.DurationMs),
			l.ClientIP,
			l.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}
	writer.Flush()

	filename := fmt.Sprintf("audit_logs_%s.csv", time.Now().Format("20060102150405"))
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Data(http.StatusOK, "text/csv; charset=utf-8", buf.Bytes())
}
