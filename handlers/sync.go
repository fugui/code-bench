package handlers

// BroadcastSync 已废弃：微服务已统一直连共享 PostgreSQL 数据库，增删改直接作用于共享数据表，无需再发送 HTTP 同步广播。
func BroadcastSync(action string, path string, id uint, data interface{}) {
	// NOP
}
