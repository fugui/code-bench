package models

import (
	"encoding/json"
	"time"

	"gorm.io/datatypes"
)

type User struct {
	ID           uint        `gorm:"primaryKey" json:"id"`                   // System internal autoincrement ID
	UniqueID     *string     `gorm:"uniqueIndex" json:"unique_id,omitempty"` // SSO platform invariant ID
	EmployeeID   string      `gorm:"index;default:''" json:"employee_id"`    // Employee ID
	EmployeeType string      `gorm:"default:''" json:"employee_type"`        // Employee Type
	Email        string      `gorm:"uniqueIndex;not null" json:"email"`      // Email address
	Username     string      `gorm:"index;default:''" json:"username"`       // Username
	Name         string      `gorm:"not null;default:''" json:"name"`        // Display name
	Password     string      `gorm:"not null" json:"-"`                      // Password hash
	RegMethod    string      `gorm:"default:'local'" json:"reg_method"`      // "local", "sso", "imported"
	IsActive     bool        `gorm:"default:true" json:"is_active"`          // Is active
	IsAdmin      bool        `gorm:"default:false" json:"is_admin"`          // Is administrator
	Roles        datatypes.JSON `gorm:"type:text" json:"roles"`              // System roles list e.g. ["pdm_admin", "pipeline_admin"]
	LastLogin    *time.Time     `json:"last_login"`
	LastIP       string      `gorm:"default:''" json:"last_ip"` // Last login IP
	DepartmentID *uint       `json:"department_id"`             // Association Department ID
	Department   *Department `gorm:"foreignKey:DepartmentID" json:"department,omitempty"`
	CreatedAt    time.Time   `json:"created_at"`
}

func (u *User) GetRoles() []string {
	var roles []string
	if len(u.Roles) > 0 {
		_ = json.Unmarshal(u.Roles, &roles)
	}
	if u.IsAdmin {
		hasSuper := false
		for _, r := range roles {
			if r == "super_admin" {
				hasSuper = true
				break
			}
		}
		if !hasSuper {
			roles = append([]string{"super_admin"}, roles...)
		}
	}
	return roles
}

type Department struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"uniqueIndex;not null" json:"name"`
	LeaderID  *uint     `json:"leader_id"` // Department Leader ID (User ID)
	Leader    *User     `gorm:"foreignKey:LeaderID" json:"leader,omitempty"`
	UserCount int64     `gorm:"-" json:"user_count"` // Virtual field
	RepoCount int64     `gorm:"-" json:"repo_count"` // Virtual field
	CreatedAt time.Time `json:"created_at"`
}

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
	Module    string    `gorm:"size:50;not null" json:"module"`          // 所涉模块："portal", "shield", "pipeline", "proto", "other"
	Title     string    `gorm:"size:255;not null" json:"title"`          // 反馈简述/标题
	Content   string    `gorm:"type:text;not null" json:"content"`       // 具体反馈内容建议
	Status    string    `gorm:"size:30;default:'pending'" json:"status"` // 处理状态："pending" (待处理), "processing" (处理中), "resolved" (已采纳/已解决), "rejected" (暂不考虑)
	Reply     string    `gorm:"type:text;default:''" json:"reply"`       // 管理员回复/采纳说明
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
