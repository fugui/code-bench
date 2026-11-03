package handlers

import (
	"code-bench/models"
	"strings"
	"testing"
)

func TestBuildRolesOrderExpr(t *testing.T) {
	// 备份现有配置
	origGateways := models.AppConfig.Gateways
	defer func() {
		models.AppConfig.Gateways = origGateways
	}()

	models.AppConfig.Gateways = map[string]models.GatewayItem{
		"shield":  {URL: "http://127.0.0.1:8080", Title: "代码质量 (Code Shield)"},
		"traefik": {URL: "http://127.0.0.1:8091", Title: "业务流量监控与重放"},
	}

	expr := buildRolesOrderExpr("DESC")
	if !strings.Contains(expr, "super_admin") {
		t.Errorf("expected super_admin in orderExpr, got: %s", expr)
	}
	if !strings.Contains(expr, "bench_admin") {
		t.Errorf("expected bench_admin in orderExpr, got: %s", expr)
	}
	if !strings.Contains(expr, "shield_admin") {
		t.Errorf("expected shield_admin in orderExpr, got: %s", expr)
	}
	if !strings.Contains(expr, "traefik_admin") {
		t.Errorf("expected traefik_admin in orderExpr, got: %s", expr)
	}
	if !strings.HasSuffix(expr, "DESC, users.created_at DESC") {
		t.Errorf("expected DESC order suffix, got: %s", expr)
	}
}

func TestIsPrivilegedRoles(t *testing.T) {
	tests := []struct {
		name     string
		roles    []string
		expected bool
	}{
		{"super_admin", []string{"super_admin"}, true},
		{"bench_admin", []string{"bench_admin"}, true},
		{"shield_admin", []string{"shield_admin"}, true},
		{"traefik_admin", []string{"traefik_admin"}, true},
		{"mixed_with_user", []string{"developer", "pipeline_admin"}, true},
		{"regular_developer", []string{"developer", "qa"}, false},
		{"empty", []string{}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isPrivilegedRoles(tt.roles); got != tt.expected {
				t.Errorf("isPrivilegedRoles(%v) = %v, expected %v", tt.roles, got, tt.expected)
			}
		})
	}
}
