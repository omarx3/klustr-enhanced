package kube

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"k8s.io/client-go/tools/clientcmd"
)

const kubeconfigFixture = `apiVersion: v1
kind: Config
current-context: prod
preferences: {}
clusters:
- name: prod-cluster
  cluster:
    server: https://prod.example.com
    certificate-authority: certs/prod-ca.crt
- name: shared-cluster
  cluster:
    server: https://shared.example.com
contexts:
- name: prod
  context:
    cluster: prod-cluster
    user: prod-user
- name: dev-a
  context:
    cluster: shared-cluster
    user: shared-user
- name: dev-b
  context:
    cluster: shared-cluster
    user: shared-user
    namespace: team-b
users:
- name: prod-user
  user:
    token: prod-token
- name: shared-user
  user:
    token: shared-token
`

func writeKubeconfig(t *testing.T, dir, name, body string) string {
	t.Helper()
	p := filepath.Join(dir, name)
	if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

func rulesFor(paths ...string) *clientcmd.ClientConfigLoadingRules {
	return &clientcmd.ClientConfigLoadingRules{Precedence: paths, DoNotResolvePaths: true}
}

var fixedNow = time.Date(2026, 10, 21, 9, 30, 0, 0, time.UTC)

func TestDeleteContextRemovesUnsharedClusterAndUserAndCurrentContext(t *testing.T) {
	dir := t.TempDir()
	path := writeKubeconfig(t, dir, "config", kubeconfigFixture)

	backups := t.TempDir()
	got, err := deleteContextFromConfig(rulesFor(path), "prod", backups, fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if got.Cluster != "prod-cluster" || got.User != "prod-user" {
		t.Fatalf("removed cluster=%q user=%q", got.Cluster, got.User)
	}
	cfg, err := clientcmd.LoadFromFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := cfg.Contexts["prod"]; ok {
		t.Fatal("context prod still present")
	}
	if _, ok := cfg.Clusters["prod-cluster"]; ok {
		t.Fatal("unshared cluster still present")
	}
	if _, ok := cfg.AuthInfos["prod-user"]; ok {
		t.Fatal("unshared user still present")
	}
	if cfg.CurrentContext != "" {
		t.Fatalf("current-context = %q, want cleared", cfg.CurrentContext)
	}
	if len(cfg.Contexts) != 2 || cfg.AuthInfos["shared-user"].Token != "shared-token" {
		t.Fatal("other entries were disturbed")
	}

	// Backup is the untouched original, with the same restrictive mode, in the
	// backup directory rather than next to the kubeconfig.
	want := filepath.Join(backups, "config.klustr-backup-20261021-093000")
	if len(got.Backups) != 1 || got.Backups[0] != want {
		t.Fatalf("backups = %v, want [%s]", got.Backups, want)
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 1 {
		t.Fatalf("kubeconfig dir has %d entries, want only the kubeconfig", len(entries))
	}
	b, _ := os.ReadFile(got.Backups[0])
	if string(b) != kubeconfigFixture {
		t.Fatal("backup differs from the original")
	}
	if st, _ := os.Stat(got.Backups[0]); st.Mode().Perm() != 0o600 {
		t.Fatalf("backup mode = %v", st.Mode().Perm())
	}
}

func TestDeleteContextKeepsSharedClusterAndUser(t *testing.T) {
	dir := t.TempDir()
	path := writeKubeconfig(t, dir, "config", kubeconfigFixture)

	got, err := deleteContextFromConfig(rulesFor(path), "dev-a", t.TempDir(), fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if got.Cluster != "" || got.User != "" {
		t.Fatalf("shared entries reported removed: %+v", got)
	}
	cfg, _ := clientcmd.LoadFromFile(path)
	if _, ok := cfg.Contexts["dev-a"]; ok {
		t.Fatal("dev-a still present")
	}
	if cfg.Contexts["dev-b"].Namespace != "team-b" || cfg.Clusters["shared-cluster"] == nil || cfg.AuthInfos["shared-user"] == nil {
		t.Fatal("shared cluster/user or the other context were removed")
	}
	if cfg.CurrentContext != "prod" {
		t.Fatalf("current-context changed to %q", cfg.CurrentContext)
	}
}

func TestDeleteContextKeepsRelativePaths(t *testing.T) {
	dir := t.TempDir()
	path := writeKubeconfig(t, dir, "config", kubeconfigFixture)
	if _, err := deleteContextFromConfig(rulesFor(path), "dev-a", t.TempDir(), fixedNow); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(path)
	if !strings.Contains(string(b), "certificate-authority: certs/prod-ca.crt") {
		t.Fatalf("relative path was rewritten:\n%s", b)
	}
}

func TestDeleteContextWritesToTheFileItCameFrom(t *testing.T) {
	dir := t.TempDir()
	main := writeKubeconfig(t, dir, "main", "apiVersion: v1\nkind: Config\ncurrent-context: other\ncontexts:\n- name: other\n  context:\n    cluster: c1\n    user: u1\nclusters:\n- name: c1\n  cluster:\n    server: https://one\nusers:\n- name: u1\n  user:\n    token: t1\n")
	extra := writeKubeconfig(t, dir, "extra", "apiVersion: v1\nkind: Config\ncontexts:\n- name: gone\n  context:\n    cluster: c2\n    user: u2\nclusters:\n- name: c2\n  cluster:\n    server: https://two\nusers:\n- name: u2\n  user:\n    token: t2\n")
	mainBefore, _ := os.ReadFile(main)

	got, err := deleteContextFromConfig(rulesFor(main, extra), "gone", t.TempDir(), fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Files) != 1 || got.Files[0] != extra {
		t.Fatalf("files = %v, want only %s", got.Files, extra)
	}
	cfg, _ := clientcmd.LoadFromFile(extra)
	if len(cfg.Contexts)+len(cfg.Clusters)+len(cfg.AuthInfos) != 0 {
		t.Fatalf("extra still has entries: %+v", cfg)
	}
	mainAfter, _ := os.ReadFile(main)
	if string(mainAfter) != string(mainBefore) {
		t.Fatal("main kubeconfig was modified")
	}
}

func TestDeleteContextUnknownNameChangesNothing(t *testing.T) {
	dir := t.TempDir()
	path := writeKubeconfig(t, dir, "config", kubeconfigFixture)
	backups := t.TempDir()
	if _, err := deleteContextFromConfig(rulesFor(path), "nope", backups, fixedNow); err == nil {
		t.Fatal("expected an error")
	}
	b, _ := os.ReadFile(path)
	if string(b) != kubeconfigFixture {
		t.Fatal("file changed")
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		t.Fatalf("unexpected files: %v", entries)
	}
	if entries, _ := os.ReadDir(backups); len(entries) != 0 {
		t.Fatalf("backup taken for a failed delete: %v", entries)
	}
}

// Two KUBECONFIG files can share a base name; both backups must survive in
// the one backup directory.
func TestBackupFileKeepsSameNamedFilesApart(t *testing.T) {
	a := writeKubeconfig(t, t.TempDir(), "config", "a")
	b := writeKubeconfig(t, t.TempDir(), "config", "b")
	backups := t.TempDir()
	first, err := backupFile(a, backups, "stamp")
	if err != nil {
		t.Fatal(err)
	}
	second, err := backupFile(b, backups, "stamp")
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatalf("both backups went to %s", first)
	}
	ga, _ := os.ReadFile(first)
	gb, _ := os.ReadFile(second)
	if string(ga) != "a" || string(gb) != "b" {
		t.Fatalf("contents = %q, %q", ga, gb)
	}
}
