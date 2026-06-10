package main

import (
	"context"
	"embed"
	"errors"
	"flag"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"code-bench/database"
	"code-bench/handlers"
	"code-bench/models"

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

	// 3. Initialize Gin engine
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	if models.AppConfig.Server.GinLog {
		r.Use(gin.Logger())
	}
	// 4. Setup embed FS for frontend
	distFS, distErr := fs.Sub(frontendFS, "frontend/dist")
	if distErr != nil {
		log.Println("Warning: frontend dist folder not found, skipping frontend embedding.")
	}

	// 5. Setup built-in dynamic reverse proxies for sub microservices
	for prefix, targetURL := range models.AppConfig.Gateways {
		target, err := url.Parse(targetURL)
		if err != nil {
			log.Fatalf("Invalid target URL for prefix %s: %v", prefix, err)
		}
		proxy := httputil.NewSingleHostReverseProxy(target)
		p := prefix // local copy for closure
		r.Any("/" + p + "/*path", func(c *gin.Context) {
			path := c.Request.URL.Path
			// Only proxy API requests, static assets, or module federation entry files
			if strings.HasPrefix(path, "/"+p+"/api") || 
			   strings.HasPrefix(path, "/"+p+"/assets") || 
			   strings.HasSuffix(path, "remoteEntry.js") {
				if models.AppConfig.Server.GinLog {
					log.Printf("[Proxy] Forwarding request %s %s to %s", c.Request.Method, path, p)
				}
				proxy.ServeHTTP(c.Writer, c.Request)
			} else {
				// Serve the portal's index.html to allow portal's frontend routing & unified authentication
				if distErr == nil {
					indexBytes, err := fs.ReadFile(distFS, "index.html")
					if err == nil {
						c.Data(http.StatusOK, "text/html; charset=utf-8", indexBytes)
						return
					}
				}
				c.JSON(http.StatusNotFound, gin.H{"error": "Resource not found"})
			}
		})
	}

	// 6. Register Core APIs (Unprotected)
	api := r.Group("/api")
	{
		api.POST("/login", handlers.Login)
		api.GET("/auth/config", handlers.GetAuthConfig)
		api.GET("/oauth2/authorize", handlers.StartOAuth2Flow)
		api.GET("/oauth2/callback", handlers.OAuth2Callback)
	}

	// Protected Core APIs
	apiProtected := r.Group("/api")
	apiProtected.Use(handlers.AuthMiddleware())
	{
		apiProtected.GET("/me", handlers.GetMe)
		apiProtected.PATCH("/password", handlers.UpdatePassword)
		apiProtected.POST("/me/department", handlers.UpdateMyDepartment)
		apiProtected.GET("/me/department-proxy", handlers.GetMyDepartmentProxy)

		// Department APIs
		apiProtected.GET("/departments", handlers.GetDepartments)
		apiProtected.POST("/departments", handlers.CreateDepartment)
		apiProtected.PATCH("/departments/:id", handlers.UpdateDepartment)
		apiProtected.DELETE("/departments/:id", handlers.DeleteDepartment)
		apiProtected.POST("/departments/import", handlers.ImportDepartments)
		apiProtected.GET("/departments/export", handlers.ExportDepartments)

		// User APIs (Admin only)
		adminUsers := apiProtected.Group("/users")
		adminUsers.Use(handlers.AdminMiddleware())
		{
			adminUsers.GET("", handlers.GetUsers)
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
	}

	// 7. Serve frontend static files
	if distErr == nil {
		httpFS := http.FS(distFS)
		r.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path

			// DO NOT serve frontend index.html for API routes
			if len(path) >= 4 && path[:4] == "/api" {
				c.JSON(http.StatusNotFound, gin.H{"error": "API route not found"})
				return
			}

			// Strip leading slash to look up in embedded FS
			cleanPath := path
			if cleanPath != "" && cleanPath != "/" {
				f, err := distFS.Open(cleanPath[1:])
				if err == nil {
					f.Close()
					c.FileFromFS(cleanPath, httpFS)
					return
				}
			}

			indexBytes, err := fs.ReadFile(distFS, "index.html")
			if err != nil {
				c.String(http.StatusNotFound, "index.html not found")
				return
			}
			c.Data(http.StatusOK, "text/html; charset=utf-8", indexBytes)
		})
	}

	// 7. Start HTTP Server
	port := models.AppConfig.Server.Port
	srv := &http.Server{
		Addr:              port,
		Handler:           r,
		ReadTimeout:       models.AppConfig.Server.ReadTimeout,
		ReadHeaderTimeout: models.AppConfig.Server.ReadHeaderTimeout,
		WriteTimeout:      models.AppConfig.Server.WriteTimeout,
		IdleTimeout:       models.AppConfig.Server.IdleTimeout,
		MaxHeaderBytes:    models.AppConfig.Server.MaxHeaderBytes,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("Starting code-bench Portal Server on %s ...\n", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("Shutting down code-bench server ...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Server exited gracefully")
}
