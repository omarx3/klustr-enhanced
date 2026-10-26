package kube

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	k8stesting "k8s.io/client-go/testing"
)

func liveService() *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "v1", "kind": "Service",
		"metadata": map[string]any{
			"name": "my-service", "namespace": "apps",
			"resourceVersion": "42", "uid": "abc",
			"managedFields": []any{map[string]any{"manager": "kubectl"}},
		},
		"spec":   map[string]any{"selector": map[string]any{"app": "Old"}},
		"status": map[string]any{"loadBalancer": map[string]any{}},
	}}
}

// The apply patch itself is out of the fake client's reach; the reactor
// records that it happened and answers with the patched object.
func applyTestManager(t *testing.T, objs ...runtime.Object) (*ClientManager, *bool) {
	t.Helper()
	m, dyn := createTestManager(objs...)
	m.backupDir = filepath.Join(t.TempDir(), "klustr-backup")
	patched := false
	dyn.PrependReactor("patch", "services", func(k8stesting.Action) (bool, runtime.Object, error) {
		patched = true
		return true, liveService(), nil
	})
	return m, &patched
}

func TestApplyBacksUpTheLiveObjectFirst(t *testing.T) {
	m, patched := applyTestManager(t, liveService())

	path, err := m.ApplyResourceYAML(context.Background(), "ctx", serviceTemplate)
	if err != nil {
		t.Fatal(err)
	}
	if !*patched {
		t.Fatal("the edit was not applied")
	}
	if filepath.Dir(path) != m.backupDir {
		t.Fatalf("backup at %s, want in %s", path, m.backupDir)
	}
	if !regexp.MustCompile(`^my-service-service-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.yaml$`).MatchString(filepath.Base(path)) {
		t.Fatalf("backup name %q does not follow name-kind-date.yaml", filepath.Base(path))
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	body := string(data)
	for _, want := range []string{"# context: ctx", "# namespace: apps", "app: Old"} {
		if !strings.Contains(body, want) {
			t.Errorf("backup lacks %q:\n%s", want, body)
		}
	}
	// The backup is a reapplyable manifest: server-owned fields are dropped.
	for _, unwanted := range []string{"resourceVersion", "managedFields", "uid:", "status:"} {
		if strings.Contains(body, unwanted) {
			t.Errorf("backup keeps %q:\n%s", unwanted, body)
		}
	}
}

func TestApplyCreatesTheBackupDirectoryOnlyWhenMissing(t *testing.T) {
	m, _ := applyTestManager(t, liveService())
	if err := os.MkdirAll(m.backupDir, 0o755); err != nil {
		t.Fatal(err)
	}
	keep := filepath.Join(m.backupDir, "notes.txt")
	if err := os.WriteFile(keep, []byte("mine"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := m.ApplyResourceYAML(context.Background(), "ctx", serviceTemplate); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(keep); err != nil {
		t.Fatalf("existing directory content was touched: %v", err)
	}
	info, err := os.Stat(m.backupDir)
	if err != nil || info.Mode().Perm() != 0o755 {
		t.Fatalf("existing directory mode changed: %v %v", info.Mode(), err)
	}
}

func TestApplyRefusesTheEditWhenTheBackupFails(t *testing.T) {
	m, patched := applyTestManager(t, liveService())
	// A file where the directory should be makes the backup impossible.
	if err := os.WriteFile(m.backupDir, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	_, err := m.ApplyResourceYAML(context.Background(), "ctx", serviceTemplate)
	if err == nil || !strings.Contains(err.Error(), "backup failed") {
		t.Fatalf("err = %v, want a backup failure", err)
	}
	if *patched {
		t.Fatal("the edit was applied without a backup")
	}
}

func TestApplyOfANewObjectTakesNoBackup(t *testing.T) {
	m, patched := applyTestManager(t)
	path, err := m.ApplyResourceYAML(context.Background(), "ctx", serviceTemplate)
	if err != nil || path != "" || !*patched {
		t.Fatalf("path=%q err=%v patched=%v", path, err, *patched)
	}
	if _, err := os.Stat(m.backupDir); !os.IsNotExist(err) {
		t.Fatalf("backup directory created for a create: %v", err)
	}
}

func TestListAndReadResourceBackups(t *testing.T) {
	dir := t.TempDir()
	at := time.Date(2026, 10, 26, 9, 30, 0, 0, time.Local)
	older, err := writeResourceBackup(dir, "ctx", liveService(), at)
	if err != nil {
		t.Fatal(err)
	}
	newer, err := writeResourceBackup(dir, "ctx", liveService(), at.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	same, err := writeResourceBackup(dir, "ctx", liveService(), at.Add(time.Hour+time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	if same == newer || !strings.HasSuffix(same, "-2.yaml") {
		t.Fatalf("a second backup in the same second must not overwrite: %s vs %s", same, newer)
	}
	// Same name in another cluster and another namespace: not this object.
	if _, err := writeResourceBackup(dir, "other-ctx", liveService(), at); err != nil {
		t.Fatal(err)
	}
	elsewhere := liveService()
	elsewhere.SetNamespace("prod")
	if _, err := writeResourceBackup(dir, "ctx", elsewhere, at); err != nil {
		t.Fatal(err)
	}

	got, err := listResourceBackups(dir, "ctx", "Service", "apps", "my-service")
	if err != nil {
		t.Fatal(err)
	}
	files := make([]string, 0, len(got))
	for _, b := range got {
		files = append(files, b.File)
	}
	want := []string{filepath.Base(same), filepath.Base(newer), filepath.Base(older)}
	if strings.Join(files, ",") != strings.Join(want, ",") {
		t.Fatalf("list = %v, want newest first %v", files, want)
	}

	manifest, err := readResourceBackup(dir, got[0].File)
	if err != nil {
		t.Fatal(err)
	}
	if strings.HasPrefix(manifest, "#") || !strings.HasPrefix(manifest, "apiVersion: v1") {
		t.Fatalf("restore manifest keeps the header:\n%s", manifest)
	}
}

func TestListResourceBackupsWithoutADirectory(t *testing.T) {
	got, err := listResourceBackups(filepath.Join(t.TempDir(), "missing"), "ctx", "Service", "apps", "x")
	if err != nil || got == nil || len(got) != 0 {
		t.Fatalf("got %v, %v; want an empty, non-nil list", got, err)
	}
}

func TestReadResourceBackupStaysInTheDirectory(t *testing.T) {
	dir := t.TempDir()
	for _, file := range []string{"../secret.yaml", "/etc/passwd", "sub/x.yaml", "notes.txt", ""} {
		if _, err := readResourceBackup(dir, file); err == nil {
			t.Errorf("readResourceBackup(%q) succeeded", file)
		}
	}
}
