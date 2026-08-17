package models

import (
	"code-common/backend/configutil"
	commonModels "code-common/backend/models"
	"log"
	"os"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type FieldMappingConfig = commonModels.FieldMappingConfig
type OAuth2Config = commonModels.OAuth2Config
type DatabaseConfig = commonModels.DatabaseConfig

type SyncConfig struct {
	Targets       []string `yaml:"targets"` // Endpoints to sync to, e.g. ["http://127.0.0.1:8080"]
	RepoDetailURL string   `yaml:"repo_detail_url"`
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
	serverCfg := configutil.ServerConfig{
		Port:              AppConfig.Server.Port,
		GinLog:            AppConfig.Server.GinLog,
		ReadTimeout:       AppConfig.Server.ReadTimeout,
		ReadHeaderTimeout: AppConfig.Server.ReadHeaderTimeout,
		WriteTimeout:      AppConfig.Server.WriteTimeout,
		IdleTimeout:       AppConfig.Server.IdleTimeout,
		MaxHeaderBytes:    AppConfig.Server.MaxHeaderBytes,
		ExternalURL:       AppConfig.Server.ExternalURL,
	}
	configutil.ApplyServerDefaults(&serverCfg, ":8000")
	AppConfig.Server.Port = serverCfg.Port
	AppConfig.Server.ExternalURL = serverCfg.ExternalURL
	AppConfig.Server.ReadTimeout = serverCfg.ReadTimeout
	AppConfig.Server.ReadHeaderTimeout = serverCfg.ReadHeaderTimeout
	AppConfig.Server.WriteTimeout = serverCfg.WriteTimeout
	AppConfig.Server.IdleTimeout = serverCfg.IdleTimeout
	AppConfig.Server.MaxHeaderBytes = serverCfg.MaxHeaderBytes

	configutil.EnsureJWTSecret(&AppConfig.Auth.JWTSecret, "Bench-Auth")

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
