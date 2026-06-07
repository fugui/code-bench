package models

import (
	"time"

	"gorm.io/datatypes"
)

type User struct {
	ID           uint        `gorm:"primaryKey" json:"id"`                      // System internal autoincrement ID
	UniqueID     *string     `gorm:"uniqueIndex" json:"unique_id,omitempty"`    // SSO platform invariant ID
	EmployeeID   string      `gorm:"index;default:''" json:"employee_id"`       // Employee ID
	EmployeeType string      `gorm:"default:''" json:"employee_type"`           // Employee Type
	Email        string      `gorm:"uniqueIndex;not null" json:"email"`         // Email address
	Name         string      `gorm:"not null;default:''" json:"name"`           // Display name
	Password     string      `gorm:"not null" json:"-"`                         // Password hash
	RegMethod    string      `gorm:"default:'local'" json:"reg_method"`         // "local", "sso", "imported"
	IsActive     bool        `gorm:"default:true" json:"is_active"`             // Is active
	IsAdmin      bool        `gorm:"default:false" json:"is_admin"`             // Is administrator
	LastLogin    *time.Time  `json:"last_login"`
	LastIP       string      `gorm:"default:''" json:"last_ip"`                 // Last login IP
	DepartmentID *uint       `json:"department_id"`                             // Association Department ID
	Department   *Department `gorm:"foreignKey:DepartmentID" json:"department,omitempty"`
	CreatedAt    time.Time   `json:"created_at"`
}

type Department struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"uniqueIndex;not null" json:"name"`
	LeaderID  *uint     `json:"leader_id"`                                    // Department Leader ID (User ID)
	Leader    *User     `gorm:"foreignKey:LeaderID" json:"leader,omitempty"`
	UserCount int64     `gorm:"-" json:"user_count"`                          // Virtual field
	RepoCount int64     `gorm:"-" json:"repo_count"`                          // Virtual field
	CreatedAt time.Time `json:"created_at"`
}

type Repository struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	DepartmentID   uint           `json:"department_id"`
	Department     Department     `gorm:"foreignKey:DepartmentID" json:"department"`
	Name           string         `gorm:"uniqueIndex;not null" json:"name"`
	URL            string         `gorm:"not null" json:"url"`
	OwnerID        uint           `json:"owner_id"`
	Owner          User           `gorm:"foreignKey:OwnerID" json:"owner"`
	Branch         string         `gorm:"default:main" json:"branch"`
	ServiceGroup   string         `gorm:"size:30" json:"service_group"`
	RelatedMembers datatypes.JSON `json:"related_members"` // Related members IDs/employee IDs
	IsActive       bool           `gorm:"default:true" json:"is_active"`
	LastCommitHash string         `json:"last_commit_hash"`
	CreatedAt      time.Time      `json:"created_at"`
}
