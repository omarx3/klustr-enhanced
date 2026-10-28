package kube

import (
	"path/filepath"
	"testing"
)

func TestMonitorStoreRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "klustr", "deployment-monitors.json")

	got, err := loadMonitorState(path)
	if err != nil || got != "" {
		t.Fatalf("missing file: got %q, %v", got, err)
	}
	state := `{"state":{"monitors":[{"context":"c","namespace":"n","name":"web"}]},"version":0}`
	if err := saveMonitorState(path, state); err != nil {
		t.Fatal(err)
	}
	if got, _ := loadMonitorState(path); got != state {
		t.Fatalf("got %q", got)
	}
	if err := saveMonitorState(path, "{not json"); err == nil {
		t.Fatal("expected invalid JSON to be rejected")
	}
	if got, _ := loadMonitorState(path); got != state {
		t.Fatal("invalid save clobbered the file")
	}
}
