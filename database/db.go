package database

import (
	"log"
	"os"
	"time"

	"code-bench/models"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	var err error
	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	var dialector gorm.Dialector
	if models.AppConfig.Database.Driver == "sqlite" || models.AppConfig.Database.Host == "" {
		log.Println("[Database] Connecting to SQLite in-memory database for testing/fallback...")
		dialector = sqlite.Open("file::memory:?cache=shared")
	} else {
		dsn := models.AppConfig.Database.GetDSN()
		log.Printf("[Database] Connecting to PostgreSQL database (%s)...", models.AppConfig.Database.DBName)
		dialector = postgres.New(postgres.Config{
			DSN:                  dsn,
			PreferSimpleProtocol: true,
		})
	}

	DB, err = gorm.Open(dialector, &gorm.Config{
		Logger:                                   newLogger,
		DisableForeignKeyConstraintWhenMigrating: true,
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
	)
	if err != nil {
		log.Fatalf("[Database] Migration failed: %v", err)
	}

	// Seed admin user
	var count int64
	DB.Model(&models.User{}).Count(&count)
	if count == 0 {
		hashed, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		admin := models.User{
			EmployeeID: "admin",
			Email:      "admin@code-shield.com",
			Name:       "管理员",
			Password:   string(hashed),
			IsAdmin:    true,
			IsActive:   true,
			RegMethod:  "local",
		}
		if err := DB.Create(&admin).Error; err != nil {
			log.Printf("[Database] Failed to seed default admin: %v", err)
		} else {
			log.Println("[Database] Seeded default admin user (email: admin@code-shield.com, password: admin123)")
		}
	}
}
