package models

import (
	commonModels "code-common/backend/models"
	"time"

	"gorm.io/datatypes"
)

type User = commonModels.User
type Department = commonModels.Department
type SysAuditLog = commonModels.SysAuditLog
type AuditLevel = commonModels.AuditLevel

const (
	AuditLevelP0 = commonModels.AuditLevelP0
	AuditLevelP1 = commonModels.AuditLevelP1
	AuditLevelP2 = commonModels.AuditLevelP2
)

type Repository struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	DepartmentID   uint           `json:"department_id"`
	Department     Department     `gorm:"foreignKey:DepartmentID" json:"department"`
	Name           string         `gorm:"uniqueIndex;not null" json:"name"`
	ProjectID      string         `gorm:"default:''" json:"project_id"` // 三方系统中的项目 ID (用于 API 交互)
	URL            string         `gorm:"not null" json:"url"`          // 仓库 SSH URL 克隆地址
	HTTPURL        string         `gorm:"default:''" json:"http_url"`   // 仓库 HTTP/HTTPS URL 访问地址
	OwnerID        uint           `json:"owner_id"`
	Owner          User           `gorm:"foreignKey:OwnerID" json:"owner"`
	Branch         string         `gorm:"default:master" json:"branch"`  // 主干分支 (默认 master)
	ServiceGroup   string         `gorm:"size:30" json:"service_group"`  // 归属子系统 (如模块分组)
	RelatedMembers datatypes.JSON `json:"related_members"`               // 相关人员 ID 列表 (分析结果将抄送给他们)
	IsActive       bool           `gorm:"default:true" json:"is_active"` // 是否启用
	LastCommitHash string         `json:"last_commit_hash"`              // 最后一次同步提交的 hash 值
	CreatedAt      time.Time      `json:"created_at"`
}

type ArchitectureElement struct {
	ID           uint                 `gorm:"primaryKey" json:"id"`
	Identifier   string               `gorm:"not null" json:"identifier"`
	NameCn       string               `gorm:"not null" json:"name_cn"`
	NameEn       string               `gorm:"not null" json:"name_en"`
	Type         string               `gorm:"not null" json:"type"` // "subsystem" | "group" | "module"
	ParentID     *uint                `json:"parent_id"`
	Parent       *ArchitectureElement `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	OwnerID      *uint                `json:"owner_id"`
	Owner        *User                `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	RepoID       *uint                `json:"repo_id"`
	Repo         *Repository          `gorm:"foreignKey:RepoID" json:"repo,omitempty"`
	Subdirectory string               `gorm:"default:''" json:"subdirectory"`
	Description  string               `gorm:"default:''" json:"description"`
	CreatedAt    time.Time            `json:"created_at"`
	UpdatedAt    time.Time            `json:"updated_at"`
}

type Feedback struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Category  string    `gorm:"size:30;default:'feature';not null" json:"category"` // 反馈类型："bug" (缺陷), "feature" (需求建议), "ux" (交互/UI), "performance" (性能), "other" (其他)
	Module    string    `gorm:"size:50;not null" json:"module"`                     // 所涉模块："portal", "shield", "pipeline", "pdm", "modelgate", "proto", "other"
	Priority  string    `gorm:"size:20;default:'medium';not null" json:"priority"`  // 优先级："low", "medium", "high", "urgent"
	Title     string    `gorm:"size:255;not null" json:"title"`                     // 反馈简述/标题
	Content   string    `gorm:"type:text;not null" json:"content"`                  // 具体反馈内容建议
	Images    string    `gorm:"type:text;default:''" json:"images"`                 // JSON 数组格式存放的贴图 URL 列表
	Status    string    `gorm:"size:30;default:'pending'" json:"status"`            // 处理状态："pending" (待处理), "processing" (处理中), "resolved" (已采纳/已解决), "rejected" (暂不考虑)
	Reply     string    `gorm:"type:text;default:''" json:"reply"`                  // 管理员回复/采纳说明
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type DocStat struct {
	DocPath   string    `gorm:"primaryKey;size:500" json:"doc_path"` // 文档相对路径
	Views     int64     `gorm:"default:0" json:"views"`              // 累计阅读次数
	UpdatedAt time.Time `json:"updated_at"`
}

type DocComment struct {
	ID        uint          `gorm:"primaryKey" json:"id"`
	DocPath   string        `gorm:"index;size:500;not null" json:"doc_path"` // 归属文档相对路径
	UserID    uint          `gorm:"index;not null" json:"user_id"`           // 发表人 ID
	User      *User         `gorm:"foreignKey:UserID" json:"user,omitempty"` // 发表人信息
	ParentID  *uint         `gorm:"index" json:"parent_id"`                  // 父评论 ID (为 nil 表示顶级评论)
	Parent    *DocComment   `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Replies   []*DocComment `gorm:"foreignKey:ParentID" json:"replies,omitempty"` // 子回复列表 (虚拟/关联)
	Content   string        `gorm:"type:text;not null" json:"content"`            // 评论内容 (支持 Markdown)
	Status    string        `gorm:"size:20;default:'active'" json:"status"`       // 状态："active" (正常), "deleted" (已删除)
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}
