package database

import (
	"code-common/backend/gormdb"
	"log"

	"code-bench/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	var err error
	DB, err = gormdb.Connect(models.AppConfig.Database, gormdb.Options{
		ServiceName: "Bench-DB",
	})
	if err != nil {
		log.Fatalf("[Database] Failed to connect database: %v", err)
	}

	log.Println("[Database] AutoMigrating database schema...")
	err = DB.AutoMigrate(
		&models.User{},
		&models.Department{},
		&models.Repository{},
		&models.ArchitectureElement{},
		&models.Feedback{},
		&models.DocStat{},
		&models.DocComment{},
		&models.SysAuditLog{},
	)
	if err != nil {
		log.Fatalf("[Database] Migration failed: %v", err)
	}

	// Seed admin user
	var count int64
	DB.Model(&models.User{}).Where("email = ?", "admin@code-shield.com").Count(&count)
	if count == 0 {
		hashed, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		admin := models.User{
			EmployeeID: "admin",
			Email:      "admin@code-shield.com",
			Name:       "管理员",
			Password:   string(hashed),
			Roles:      datatypes.JSON([]byte("[\"super_admin\"]")),
			IsActive:   true,
			IsAdmin:    true,
			RegMethod:  "local",
		}
		if err := DB.Create(&admin).Error; err != nil {
			log.Printf("[Database] Failed to seed default admin: %v", err)
		} else {
			log.Println("[Database] Seeded default admin user (email: admin@code-shield.com, password: admin123)")
		}
	}
}
