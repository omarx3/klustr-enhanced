package kube

import (
	"os"
	"path/filepath"
	"testing"
)

// End to end through the exported entry point: the real ClientManager, the
// default loading rules and os.UserConfigDir, with KUBECONFIG and the config
// home pointed at temp dirs.
func TestDeleteKubeconfigContextBacksUpIntoKlustrConfigDir(t *testing.T) {
	kubeDir := t.TempDir()
	configHome := t.TempDir()
	path := writeKubeconfig(t, kubeDir, "config", kubeconfigFixture)
	t.Setenv("KUBECONFIG", path)
	t.Setenv("XDG_CONFIG_HOME", configHome) // Linux
	t.Setenv("HOME", configHome)            // macOS: ~/Library/Application Support
	t.Setenv("AppData", configHome)         // Windows

	want, err := kubeconfigBackupDir()
	if err != nil {
		t.Fatal(err)
	}
	out, err := NewClientManager().DeleteKubeconfigContext("prod")
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Backups) != 1 || filepath.Dir(out.Backups[0]) != want || filepath.Base(want) != "klustr" {
		t.Fatalf("backups = %v, want one in %s", out.Backups, want)
	}
	if b, _ := os.ReadFile(out.Backups[0]); string(b) != kubeconfigFixture {
		t.Fatal("backup is not the original kubeconfig")
	}
	if entries, _ := os.ReadDir(kubeDir); len(entries) != 1 {
		t.Fatalf("files left next to the kubeconfig: %v", entries)
	}
}
