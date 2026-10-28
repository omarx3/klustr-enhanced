package kube

import (
	"os"
	"strings"
	"testing"
	"time"

	"k8s.io/client-go/tools/clientcmd"
)

const pastedFixture = `apiVersion: v1
kind: Config
current-context: staging
clusters:
- name: staging-cluster
  cluster:
    server: https://staging.example.com
- name: shared-cluster
  cluster:
    server: https://shared.example.com
contexts:
- name: staging
  context:
    cluster: staging-cluster
    user: staging-user
users:
- name: staging-user
  user:
    token: staging-token
`

func TestMergeKubeconfigAddsNewEntries(t *testing.T) {
	dir := t.TempDir()
	path := writeKubeconfig(t, dir, "config", kubeconfigFixture)
	rules := rulesFor(path)

	out, err := mergeIntoConfig(rules, pastedFixture, time.Unix(0, 0))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(out.Contexts, ",") != "staging" || strings.Join(out.Clusters, ",") != "staging-cluster" || strings.Join(out.Users, ",") != "staging-user" {
		t.Fatalf("unexpected result: %+v", out)
	}
	if out.Backup == "" {
		t.Fatal("expected a backup")
	}
	cfg, err := clientcmd.LoadFromFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := cfg.Contexts["staging"]; !ok {
		t.Fatal("staging context not written")
	}
	if _, ok := cfg.Contexts["prod"]; !ok {
		t.Fatal("existing context lost")
	}
	if cfg.CurrentContext != "prod" {
		t.Fatalf("current-context changed to %q", cfg.CurrentContext)
	}
	if cfg.Clusters["prod-cluster"].CertificateAuthority != "certs/prod-ca.crt" {
		t.Fatal("relative path was rewritten")
	}
}

func TestMergeKubeconfigRejectsConflicts(t *testing.T) {
	dir := t.TempDir()
	path := writeKubeconfig(t, dir, "config", kubeconfigFixture)
	before, _ := os.ReadFile(path)
	pasted := strings.Replace(pastedFixture, "https://shared.example.com", "https://other.example.com", 1)

	if _, err := mergeIntoConfig(rulesFor(path), pasted, time.Unix(0, 0)); err == nil || !strings.Contains(err.Error(), "cluster shared-cluster") {
		t.Fatalf("expected conflict error, got %v", err)
	}
	after, _ := os.ReadFile(path)
	if string(before) != string(after) {
		t.Fatal("file changed despite conflict")
	}
}

func TestMergeKubeconfigRejectsBadInput(t *testing.T) {
	path := writeKubeconfig(t, t.TempDir(), "config", kubeconfigFixture)
	for _, in := range []string{"", "not: [yaml", "apiVersion: v1\nkind: Config\n", kubeconfigFixture} {
		if _, err := mergeIntoConfig(rulesFor(path), in, time.Unix(0, 0)); err == nil {
			t.Fatalf("expected error for %q", in)
		}
	}
}

func TestMergeKubeconfigCreatesMissingFile(t *testing.T) {
	path := t.TempDir() + "/config"
	out, err := mergeIntoConfig(rulesFor(path), pastedFixture, time.Unix(0, 0))
	if err != nil {
		t.Fatal(err)
	}
	if out.Backup != "" {
		t.Fatal("no backup expected for a new file")
	}
	if cfg, err := clientcmd.LoadFromFile(path); err != nil || cfg.Contexts["staging"] == nil {
		t.Fatalf("file not written: %v", err)
	}
}
