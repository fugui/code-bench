package models

import (
	"testing"
)

func TestGateModuleSuperAdminOnly(t *testing.T) {
	// 验证 knownModules 中 gate 默认被标记为 SuperAdminOnly
	gateMod, ok := knownModules["gate"]
	if !ok {
		t.Fatalf("expected knownModules to contain gate")
	}
	if !gateMod.SuperAdminOnly {
		t.Errorf("expected gate module SuperAdminOnly to be true, got false")
	}

	// 验证 buildModuleMeta 正确传递 SuperAdminOnly
	item := GatewayItem{
		URL: "http://127.0.0.1:8088",
	}
	meta := buildModuleMeta("gate", item)
	if !meta.SuperAdminOnly {
		t.Errorf("expected buildModuleMeta for gate to have SuperAdminOnly true")
	}

	// 验证自定义 GatewayItem 显式指定 SuperAdminOnly
	customItem := GatewayItem{
		URL:            "http://127.0.0.1:9999",
		Title:          "Custom Gate",
		SuperAdminOnly: true,
	}
	customMeta := buildModuleMeta("custom", customItem)
	if !customMeta.SuperAdminOnly {
		t.Errorf("expected custom module with SuperAdminOnly true to have SuperAdminOnly true")
	}
}
