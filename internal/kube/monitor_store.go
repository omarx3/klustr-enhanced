package kube

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// The deployment monitor list and its alert history are owned by the
// frontend; the backend only keeps them on disk so they survive restarts.
// The webview's localStorage is not reliable for that: it differs between
// the native window and the dev browser, and can be cleared with the cache.

var monitorStoreMu sync.Mutex

func monitorStorePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "klustr", "deployment-monitors.json"), nil
}

// LoadMonitorState returns the saved state, or "" when nothing was saved.
func LoadMonitorState() (string, error) {
	path, err := monitorStorePath()
	if err != nil {
		return "", err
	}
	return loadMonitorState(path)
}

// SaveMonitorState writes the state, which must be valid JSON.
func SaveMonitorState(state string) error {
	path, err := monitorStorePath()
	if err != nil {
		return err
	}
	return saveMonitorState(path, state)
}

func loadMonitorState(path string) (string, error) {
	monitorStoreMu.Lock()
	defer monitorStoreMu.Unlock()
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func saveMonitorState(path, state string) error {
	if !json.Valid([]byte(state)) {
		return fmt.Errorf("monitor state is not valid JSON")
	}
	monitorStoreMu.Lock()
	defer monitorStoreMu.Unlock()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	// Write then rename, so a crash mid-write never leaves a truncated file
	// that would lose every monitor on the next start.
	tmp, err := os.CreateTemp(filepath.Dir(path), ".deployment-monitors-*.json")
	if err != nil {
		return err
	}
	if _, err := tmp.WriteString(state); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmp.Name())
		return err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmp.Name())
		return err
	}
	return os.Rename(tmp.Name(), path)
}
