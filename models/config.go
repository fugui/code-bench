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

type GatewayItem struct {
	URL         string `yaml:"url" json:"url"`
	Title       string `yaml:"title" json:"title"`
	Icon        string `yaml:"icon" json:"icon"`
	Description string `yaml:"description" json:"description"`
}

// UnmarshalYAML 支持字符串格式 ("http://...") 和对象格式 ({ url: "...", title: "..." })
func (g *GatewayItem) UnmarshalYAML(value *yaml.Node) error {
	if value.Kind == yaml.ScalarNode {
		g.URL = value.Value
		return nil
	}
	type rawGateway GatewayItem
	var raw rawGateway
	if err := value.Decode(&raw); err != nil {
		return err
	}
	*g = GatewayItem(raw)
	return nil
}

type ModuleMeta struct {
	Key         string `json:"key"`
	Path        string `json:"path"`
	Entry       string `json:"entry"`
	Title       string `json:"title"`
	Icon        string `json:"icon"`
	Description string `json:"description"`
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
	Database DatabaseConfig         `yaml:"database"`
	Sync     SyncConfig             `yaml:"sync"`
	Docs     DocsConfig             `yaml:"docs"`
	Gateways map[string]GatewayItem `yaml:"gateways"`
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
		AppConfig.Gateways = make(map[string]GatewayItem)
	}
	if _, ok := AppConfig.Gateways["shield"]; !ok {
		shieldTargetURL := "http://127.0.0.1:8080"
		if len(AppConfig.Sync.Targets) > 0 {
			shieldTargetURL = AppConfig.Sync.Targets[0]
		}
		AppConfig.Gateways["shield"] = GatewayItem{URL: shieldTargetURL}
	}
}

var knownModules = map[string]ModuleMeta{
	"shield": {
		Key:         "shield",
		Path:        "/shield",
		Title:       "代码质量 (Code Shield)",
		Icon:        "Shield",
		Description: "码盾守护代码质量与资产安全。支持自动化代码评审、敏感信息扫描、合规性审计等功能。",
	},
	"pipeline": {
		Key:         "pipeline",
		Path:        "/pipeline",
		Title:       "持续构建 (Code Pipeline)",
		Icon:        "Activity",
		Description: "自动化持续构建与流水线管理。支持代码仓同步、流水线配置、多方案执行以及看板状态大屏呈现。",
	},
	"proto": {
		Key:         "proto",
		Path:        "/proto",
		Title:       "接口文稿 (Code Proto)",
		Icon:        "FileCode",
		Description: "接口规范与协议文稿管理，支持在线编辑与协作沉淀。",
	},
	"pdm": {
		Key:         "pdm",
		Path:        "/pdm",
		Title:       "产品数据管理 (PDM)",
		Icon:        "ClipboardList",
		Description: "规范物理产品大类与设备ID档案。支持按规则下拉过滤、设备ID首字母/后缀拼合生成及资产数据导出。",
	},
}

func GetActiveModules() []ModuleMeta {
	modules := make([]ModuleMeta, 0, len(AppConfig.Gateways))
	priorityOrder := []string{"shield", "pipeline", "pdm", "proto"}
	processed := make(map[string]bool)

	for _, key := range priorityOrder {
		if item, ok := AppConfig.Gateways[key]; ok {
			modules = append(modules, buildModuleMeta(key, item))
			processed[key] = true
		}
	}

	for key, item := range AppConfig.Gateways {
		if !processed[key] {
			modules = append(modules, buildModuleMeta(key, item))
		}
	}

	return modules
}

func buildModuleMeta(key string, item GatewayItem) ModuleMeta {
	meta := ModuleMeta{
		Key:   key,
		Path:  "/" + key,
		Entry: "/" + key + "/assets/remoteEntry.js",
	}
	known, isKnown := knownModules[key]
	if isKnown {
		meta.Title = known.Title
		meta.Icon = known.Icon
		meta.Description = known.Description
	} else {
		meta.Title = strings.ToUpper(key[:1]) + key[1:]
		meta.Icon = "Layers"
		meta.Description = "微前端应用系统"
	}

	if item.Title != "" {
		meta.Title = item.Title
	}
	if item.Icon != "" {
		meta.Icon = item.Icon
	}
	if item.Description != "" {
		meta.Description = item.Description
	}

	return meta
}
