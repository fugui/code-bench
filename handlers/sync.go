package handlers

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"code-bench/models"
)

type SyncPayload struct {
	Action string      `json:"action"` // "upsert" or "delete"
	Data   interface{} `json:"data,omitempty"`
	ID     uint        `json:"id,omitempty"`
}

func BroadcastSync(action string, path string, id uint, data interface{}) {
	targets := models.AppConfig.Sync.Targets
	if len(targets) == 0 {
		return
	}

	payload := SyncPayload{
		Action: action,
		Data:   data,
		ID:     id,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[Sync] Failed to marshal sync payload: %v", err)
		return
	}

	// Run in a background goroutine to not block the API
	go func() {
		client := &http.Client{Timeout: 5 * time.Second}
		for _, target := range targets {
			targetURL := strings.TrimRight(target, "/") + path
			
			req, err := http.NewRequest("POST", targetURL, bytes.NewBuffer(payloadBytes))
			if err != nil {
				log.Printf("[Sync] Failed to create sync request for %s: %v", targetURL, err)
				continue
			}
			req.Header.Set("Content-Type", "application/json")
			// Add a simple shared authorization token or secret if desired, for now simple post
			
			resp, err := client.Do(req)
			if err != nil {
				log.Printf("[Sync] Failed to send sync payload to %s: %v", targetURL, err)
				continue
			}
			resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				log.Printf("[Sync] Target %s returned status %d", targetURL, resp.StatusCode)
			} else {
				log.Printf("[Sync] Successfully synced %s (%s ID:%d) to %s", action, path, id, targetURL)
			}
		}
	}()
}
