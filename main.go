package main

import (
	"context"
	"embed"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"code-bench/database"
	"code-bench/handlers"
	"code-bench/models"
	commonAudit "code-common/backend/audit"
	commonAuth "code-common/backend/auth"
	commonServer "code-common/backend/server"

	"github.com/gin-gonic/gin"
)

//go:embed all:frontend/dist
var frontendFS embed.FS

func main() {
	configPath := flag.String("config", "config.yaml", "Path to config file")
	flag.Parse()

	// 1. Load configuration
	if err := models.LoadConfig(*configPath); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 2. Initialize Database
	database.InitDB()

	// 初始化系统全局操作审计引擎
	commonAudit.Init(database.DB)

	// 3. 启动统一服务器
	err := commonServer.Run(commonServer.Options{
		ServiceName:       "code-bench Portal",
		Port:              models.AppConfig.Server.Port,
		GinLog:            models.AppConfig.Server.GinLog,
		ReadTimeout:       models.AppConfig.Server.ReadTimeout,
		ReadHeaderTimeout: models.AppConfig.Server.ReadHeaderTimeout,
		WriteTimeout:      models.AppConfig.Server.WriteTimeout,
		IdleTimeout:       models.AppConfig.Server.IdleTimeout,
		MaxHeaderBytes:    models.AppConfig.Server.MaxHeaderBytes,
		FrontendFS:        &frontendFS,
		CustomMiddlewares: []gin.HandlerFunc{
			commonAudit.Middleware("bench"),
			gin.CustomRecovery(func(c *gin.Context, err any) {
				if err == http.ErrAbortHandler {
					c.Abort()
					return
				}
				errStr := fmt.Sprintf("%v", err)
				if strings.Contains(errStr, "net/http: abort Handler") || strings.Contains(errStr, "broken pipe") {
					c.Abort()
					return
				}
				log.Printf("[Recovery] panic recovered: %v", err)
				c.AbortWithStatus(http.StatusInternalServerError)
			}),
		},
		OnShutdown: func(ctx context.Context) {
			_ = commonAudit.Close(ctx)
		},
		RegisterRoutes: func(r *gin.Engine) {
			// Setup built-in dynamic reverse proxies for sub microservices
			for prefix, targetURL := range models.AppConfig.Gateways {
				target, err := url.Parse(targetURL)
				if err != nil {
					log.Fatalf("Invalid target URL for prefix %s: %v", prefix, err)
				}
				proxy := httputil.NewSingleHostReverseProxy(target)
				proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
					if errors.Is(err, context.Canceled) || strings.Contains(err.Error(), "context canceled") {
						return
					}
					log.Printf("[Proxy Error] %v", err)
					w.WriteHeader(http.StatusBadGateway)
				}
				p := prefix
				forwardHandler := func(c *gin.Context) {
					if models.AppConfig.Server.GinLog {
						log.Printf("[Proxy] Forwarding request %s %s to %s", c.Request.Method, c.Request.URL.Path, p)
					}
					proxy.ServeHTTP(c.Writer, c.Request)
				}
				r.Any("/"+p+"/api", forwardHandler)
				r.Any("/"+p+"/api/*path", forwardHandler)
				r.Any("/"+p+"/assets/*path", forwardHandler)
				r.Any("/"+p+"/remoteEntry.js", forwardHandler)
			}

			// Register Core APIs (Unprotected)
			api := r.Group("/api")
			{
				api.POST("/login", handlers.Login)
				api.GET("/auth/config", handlers.GetAuthConfig)
				api.GET("/oauth2/authorize", handlers.StartOAuth2Flow)
				api.GET("/oauth2/callback", handlers.OAuth2Callback)
				api.GET("/docs/raw", handlers.GetDocRaw)
			}

			// Protected Core APIs
			apiProtected := r.Group("/api")
			apiProtected.Use(commonAuth.AuthMiddleware(commonAuth.AuthConfig{
				JWTSecretGetter: func() string { return models.AppConfig.Auth.JWTSecret },
				DB:              database.DB,
				PreloadAssocs:   []string{"Department"},
			}))
			{
				apiProtected.GET("/me", handlers.GetMe)
				apiProtected.PATCH("/password", handlers.UpdatePassword)
				apiProtected.POST("/me/department", handlers.UpdateMyDepartment)
				apiProtected.GET("/me/department-proxy", handlers.GetMyDepartmentProxy)

				// Developer Docs APIs
				apiProtected.GET("/docs/tree", handlers.GetDocsTree)
				apiProtected.GET("/docs/content", handlers.GetDocContent)
				apiProtected.GET("/docs/comments", handlers.GetDocComments)
				apiProtected.POST("/docs/comments", handlers.CreateDocComment)
				apiProtected.DELETE("/docs/comments/:id", handlers.DeleteDocComment)

				// Department APIs
				apiProtected.GET("/departments", handlers.GetDepartments)
				apiProtected.POST("/departments", handlers.CreateDepartment)
				apiProtected.PATCH("/departments/:id", handlers.UpdateDepartment)
				apiProtected.DELETE("/departments/:id", handlers.DeleteDepartment)
				apiProtected.POST("/departments/import", handlers.ImportDepartments)
				apiProtected.GET("/departments/export", handlers.ExportDepartments)

				// User APIs
				apiProtected.GET("/users", handlers.GetUsers)

				adminUsers := apiProtected.Group("/users")
				adminUsers.Use(commonAuth.RequireAdmin())
				{
					adminUsers.POST("", handlers.CreateUser)
					adminUsers.PUT("/:id", handlers.UpdateUser)
					adminUsers.PATCH("/:id/status", handlers.UpdateUserStatus)
					adminUsers.DELETE("/:id", handlers.DeleteUser)
					adminUsers.POST("/import", handlers.ImportUsers)
					adminUsers.GET("/export", handlers.ExportUsers)
				}

				// Repository APIs
				apiProtected.GET("/repos", handlers.GetRepos)
				apiProtected.POST("/repos", handlers.CreateRepo)
				apiProtected.PATCH("/repos/:id", handlers.UpdateRepo)
				apiProtected.DELETE("/repos/:id", handlers.DeleteRepo)
				apiProtected.POST("/repos/import", handlers.ImportRepos)
				apiProtected.GET("/repos/export", handlers.ExportRepos)

				// Architecture Element APIs
				apiProtected.GET("/arch-elements", handlers.GetArchElements)
				apiProtected.POST("/arch-elements", handlers.CreateArchElement)
				apiProtected.PATCH("/arch-elements/:id", handlers.UpdateArchElement)
				apiProtected.DELETE("/arch-elements/:id", handlers.DeleteArchElement)

				// Feedback APIs
				apiProtected.GET("/feedbacks", handlers.GetFeedbacks)
				apiProtected.POST("/feedbacks", handlers.CreateFeedback)
				apiProtected.POST("/feedbacks/upload", handlers.UploadFeedbackImage)
				apiProtected.PATCH("/feedbacks/:id", handlers.UpdateFeedback)

				// Global Operation Audit APIs
				apiProtected.GET("/audit-logs", handlers.GetAuditLogs)
				apiProtected.GET("/audit-logs/stats", handlers.GetAuditLogStats)
				apiProtected.GET("/audit-logs/:id", handlers.GetAuditLogDetail)

				adminAudit := apiProtected.Group("/audit-logs")
				adminAudit.Use(commonAuth.RequireAdmin())
				{
					adminAudit.GET("/export", handlers.ExportAuditLogs)
					adminAudit.DELETE("", handlers.ClearAuditLogs)
				}
			}

			// Serve uploaded images statically
			r.Static("/uploads", "./uploads")
		},
	})
	if err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
