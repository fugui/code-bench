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

func TestModuleOrderAndSorting(t *testing.T) {
	// 1. 验证已知模块有默认 Order，且 shield < pipeline < pdm < gate < proto
	if knownModules["shield"].Order >= knownModules["pipeline"].Order {
		t.Errorf("expected shield order < pipeline order")
	}
	if knownModules["pipeline"].Order >= knownModules["pdm"].Order {
		t.Errorf("expected pipeline order < pdm order")
	}
	if knownModules["pdm"].Order >= knownModules["gate"].Order {
		t.Errorf("expected pdm order < gate order")
	}

	// 2. 验证自定义 Order 可以覆盖默认 Order
	itemWithCustomOrder := GatewayItem{
		URL:   "http://127.0.0.1:8080",
		Order: 99,
	}
	meta := buildModuleMeta("shield", itemWithCustomOrder)
	if meta.Order != 99 {
		t.Errorf("expected meta.Order to be 99, got %d", meta.Order)
	}

	// 3. 验证未指定 Order 的自定义模块默认 Order 为 100
	customUnknown := GatewayItem{
		URL: "http://127.0.0.1:8099",
	}
	unknownMeta := buildModuleMeta("custom_app", customUnknown)
	if unknownMeta.Order != 100 {
		t.Errorf("expected unknown module default order to be 100, got %d", unknownMeta.Order)
	}

	// 4. 验证 GetActiveModules 稳定排序
	// 备份现有 AppConfig.Gateways
	origGateways := AppConfig.Gateways
	defer func() {
		AppConfig.Gateways = origGateways
	}()

	AppConfig.Gateways = map[string]GatewayItem{
		"traefik": {
			URL:   "http://127.0.0.1:8091",
			Order: 5, // 设为 5，比 shield (10) 更小，应当排在第一位
		},
		"shield": {
			URL: "http://127.0.0.1:8080",
			// 继承默认 Order: 10
		},
		"pdm": {
			URL:   "http://127.0.0.1:8085",
			Order: 15, // 显式调整为 15
		},
		"pipeline": {
			URL: "http://127.0.0.1:8082",
			// 继承默认 Order: 20
		},
		"beta_mod": {
			URL:   "http://127.0.0.1:8092",
			Order: 200,
		},
		"alpha_mod": {
			URL:   "http://127.0.0.1:8093",
			Order: 200, // 相同 Order: 200，应当按 key 字母排序 (alpha_mod < beta_mod)
		},
	}

	// 多次调用 GetActiveModules 验证结果严格稳定
	expectedKeys := []string{"traefik", "shield", "pdm", "pipeline", "alpha_mod", "beta_mod"}
	for run := 0; run < 10; run++ {
		active := GetActiveModules()
		if len(active) != len(expectedKeys) {
			t.Fatalf("run %d: expected %d modules, got %d", run, len(expectedKeys), len(active))
		}
		for i, expectedKey := range expectedKeys {
			if active[i].Key != expectedKey {
				t.Errorf("run %d: index %d expected key %s, got %s", run, i, expectedKey, active[i].Key)
			}
		}
	}
}
