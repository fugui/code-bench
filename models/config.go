package models

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type FieldMappingConfig struct {
	Username     string `yaml:"username"`
	Email        string `yaml:"email"`
	Name         string `yaml:"name"`
	EmployeeID   string `yaml:"employee_id"`
	UniqueID     string `yaml:"unique_id"`
	EmployeeType string `yaml:"employee_type"`
}

type OAuth2Config struct {
	Enabled             bool               `yaml:"enabled"`
	ClientID            string             `yaml:"client_id"`
	ClientSecret        string             `yaml:"client_secret"`
	AuthURL             string             `yaml:"auth_url"`
	TokenURL            string             `yaml:"token_url"`
	UserInfoURL         string             `yaml:"userinfo_url"`
	RedirectURL         string             `yaml:"redirect_url"`
	Scopes              []string           `yaml:"scopes"`
	AdminList           []string           `yaml:"admin_list"`
	AllowedEmailDomains []string           `yaml:"allowed_email_domains"`
	FieldMapping        FieldMappingConfig `yaml:"field_mapping"`
	DeptAPIURL          string             `yaml:"dept_api_url"`
}

type SyncConfig struct {
	Targets       []string `yaml:"targets"` // Endpoints to sync to, e.g. ["http://127.0.0.1:8080"]
	RepoDetailURL string   `yaml:"repo_detail_url"`
}

type DatabaseConfig struct {
	Driver       string `yaml:"driver"`
	Host         string `yaml:"host"`
	Port         int    `yaml:"port"`
	User         string `yaml:"user"`
	Password     string `yaml:"password"`
	DBName       string `yaml:"dbname"`
	SSLMode      string `yaml:"sslmode"`
	TimeZone     string `yaml:"timezone"`
	MaxOpenConns int    `yaml:"max_open_conns"`
	MaxIdleConns int    `yaml:"max_idle_conns"`
}

func (d *DatabaseConfig) GetDSN() string {
	host := d.Host
	if host == "" {
		host = "127.0.0.1"
	}
	port := d.Port
	if port <= 0 {
		port = 5432
	}
	user := d.User
	if user == "" {
		user = "postgres"
	}
	dbname := d.DBName
	if dbname == "" {
		dbname = "code_shield"
	}
	sslmode := d.SSLMode
	if sslmode == "" {
		sslmode = "disable"
	}
	timezone := d.TimeZone
	if timezone == "" {
		timezone = "Asia/Shanghai"
	}
	return fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%d sslmode=%s TimeZone=%s",
		host, user, d.Password, dbname, port, sslmode, timezone)
}

type DocsConfig struct {
	Path string `yaml:"path"`
}

type Config struct {
	Server struct {
		Port              string        `yaml:"port"`
		GinLog            bool          `yaml:"gin_log"`
		ReadTimeout       time.Duration `yaml:"read_timeout"`
		ReadHeaderTimeout time.Duration `yaml:"read_header_timeout"`
		WriteTimeout      time.Duration `yaml:"write_timeout"`
		IdleTimeout       time.Duration `yaml:"idle_timeout"`
		MaxHeaderBytes    int           `yaml:"max_header_bytes"`
		ExternalURL       string        `yaml:"external_url"`
	} `yaml:"server"`
	Auth struct {
		JWTSecret            string       `yaml:"jwt_secret"`
		PasswordLoginEnabled bool         `yaml:"password_login_enabled"`
		OAuth2               OAuth2Config `yaml:"oauth2"`
	} `yaml:"auth"`
	Database DatabaseConfig    `yaml:"database"`
	Sync     SyncConfig        `yaml:"sync"`
	Docs     DocsConfig        `yaml:"docs"`
	Gateways map[string]string `yaml:"gateways"`
}

var AppConfig Config

func LoadConfig(filename string) error {
	data, err := os.ReadFile(filename)
	if err != nil {
		// If config.yaml is not found, we can try using default configuration
		if os.IsNotExist(err) {
			log.Println("[Config] config.yaml not found. Using defaults.")
			applyDefaults()
			return nil
		}
		return err
	}
	if err := yaml.Unmarshal(data, &AppConfig); err != nil {
		return err
	}

	applyDefaults()
	return nil
}

func applyDefaults() {
	if AppConfig.Server.Port == "" {
		AppConfig.Server.Port = ":8000"
	}
	if AppConfig.Server.ExternalURL == "" {
		port := AppConfig.Server.Port
		if strings.HasPrefix(port, ":") {
			AppConfig.Server.ExternalURL = "http://127.0.0.1" + port
		} else {
			AppConfig.Server.ExternalURL = "http://127.0.0.1:8000"
		}
	}
	if AppConfig.Server.ReadTimeout == 0 {
		AppConfig.Server.ReadTimeout = 15 * time.Second
	}
	if AppConfig.Server.ReadHeaderTimeout == 0 {
		AppConfig.Server.ReadHeaderTimeout = 10 * time.Second
	}
	if AppConfig.Server.WriteTimeout == 0 {
		AppConfig.Server.WriteTimeout = 15 * time.Second
	}
	if AppConfig.Server.IdleTimeout == 0 {
		AppConfig.Server.IdleTimeout = 60 * time.Second
	}
	if AppConfig.Server.MaxHeaderBytes == 0 {
		AppConfig.Server.MaxHeaderBytes = 1 << 20 // 1MB
	}

	if AppConfig.Auth.JWTSecret == "" {
		randomBytes := make([]byte, 32)
		if _, err := rand.Read(randomBytes); err != nil {
			log.Fatalf("Failed to generate random JWT secret: %v", err)
		}
		AppConfig.Auth.JWTSecret = hex.EncodeToString(randomBytes)
		log.Println("[Auth] WARNING: jwt_secret not configured. Using ephemeral random secret. Sessions will be lost on restart.")
	}

	if !AppConfig.Auth.OAuth2.Enabled && !AppConfig.Auth.PasswordLoginEnabled {
		AppConfig.Auth.PasswordLoginEnabled = true
	}

	if AppConfig.Auth.OAuth2.Enabled {
		if len(AppConfig.Auth.OAuth2.Scopes) == 0 {
			AppConfig.Auth.OAuth2.Scopes = []string{"openid", "profile", "email"}
		}
		if AppConfig.Auth.OAuth2.FieldMapping.Username == "" {
			AppConfig.Auth.OAuth2.FieldMapping.Username = "preferred_username"
		}
		if AppConfig.Auth.OAuth2.FieldMapping.Email == "" {
			AppConfig.Auth.OAuth2.FieldMapping.Email = "email"
		}
		if AppConfig.Auth.OAuth2.FieldMapping.Name == "" {
			AppConfig.Auth.OAuth2.FieldMapping.Name = "name"
		}
		if AppConfig.Auth.OAuth2.FieldMapping.EmployeeID == "" {
			AppConfig.Auth.OAuth2.FieldMapping.EmployeeID = "employee_id"
		}
		if AppConfig.Auth.OAuth2.FieldMapping.UniqueID == "" {
			AppConfig.Auth.OAuth2.FieldMapping.UniqueID = "unique_id"
		}
		if AppConfig.Auth.OAuth2.FieldMapping.EmployeeType == "" {
			AppConfig.Auth.OAuth2.FieldMapping.EmployeeType = "employee_type"
		}
		if AppConfig.Auth.OAuth2.RedirectURL == "" {
			AppConfig.Auth.OAuth2.RedirectURL = strings.TrimRight(AppConfig.Server.ExternalURL, "/") + "/api/oauth2/callback"
		}
	}

	if AppConfig.Gateways == nil {
		AppConfig.Gateways = make(map[string]string)
	}
	if _, ok := AppConfig.Gateways["shield"]; !ok {
		shieldTargetURL := "http://127.0.0.1:8080"
		if len(AppConfig.Sync.Targets) > 0 {
			shieldTargetURL = AppConfig.Sync.Targets[0]
		}
		AppConfig.Gateways["shield"] = shieldTargetURL
	}
}
