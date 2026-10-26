package kube

import (
	"bufio"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"sigs.k8s.io/yaml"
)

// Every YAML edit first saves the live object to a file in the user's home,
// so a bad change can be rolled back from the YAML tab even when the cluster
// keeps no history for that kind. Files are plain manifests named
// <name>-<kind>-<date>.yaml; a comment header records where the object came
// from, since the name alone does not say which cluster or namespace.

const (
	backupDirName     = "klustr-backup"
	backupHeaderStart = "# klustr backup"
	// Local time, without colons: Windows forbids them in file names.
	backupDateLayout = "2006-01-02_15-04-05"
)

// ResourceBackup describes one backup file for the restore list.
type ResourceBackup struct {
	File      string `json:"file"`
	Context   string `json:"context"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	TakenAt   string `json:"takenAt"`
}

func defaultBackupDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("find home directory: %w", err)
	}
	return filepath.Join(home, backupDirName), nil
}

// ensureBackupDir creates the backup directory only when it is missing; an
// existing one, with whatever permissions the user gave it, is left as is.
func ensureBackupDir(dir string) error {
	info, err := os.Stat(dir)
	switch {
	case err == nil:
		if !info.IsDir() {
			return fmt.Errorf("%s exists and is not a directory", dir)
		}
		return nil
	case errors.Is(err, fs.ErrNotExist):
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return fmt.Errorf("create %s: %w", dir, err)
		}
		return nil
	default:
		return fmt.Errorf("check %s: %w", dir, err)
	}
}

var unsafeFileChars = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

func backupFileStem(name, kind string) string {
	clean := func(s string) string {
		return strings.Trim(unsafeFileChars.ReplaceAllString(s, "_"), "._")
	}
	return clean(name) + "-" + clean(strings.ToLower(kind))
}

// writeResourceBackup saves obj (the live object, before an edit) and returns
// the file's path. A second backup within the same second gets a numeric
// suffix instead of overwriting the first.
func writeResourceBackup(dir, contextName string, obj *unstructured.Unstructured, now time.Time) (string, error) {
	if err := ensureBackupDir(dir); err != nil {
		return "", err
	}
	clone := obj.DeepCopy()
	sanitizeForYAML(clone)
	body, err := yaml.Marshal(clone.Object)
	if err != nil {
		return "", err
	}
	header := fmt.Sprintf("%s\n# context: %s\n# kind: %s\n# namespace: %s\n# name: %s\n# taken: %s\n",
		backupHeaderStart, contextName, obj.GetKind(), obj.GetNamespace(), obj.GetName(), now.Format(time.RFC3339Nano))
	base := backupFileStem(obj.GetName(), obj.GetKind()) + "-" + now.Format(backupDateLayout)
	for i := 1; ; i++ {
		file := base + ".yaml"
		if i > 1 {
			file = fmt.Sprintf("%s-%d.yaml", base, i)
		}
		path := filepath.Join(dir, file)
		f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
		if errors.Is(err, fs.ErrExist) {
			continue
		}
		if err != nil {
			return "", err
		}
		_, werr := f.WriteString(header + string(body))
		cerr := f.Close()
		if werr != nil {
			return "", werr
		}
		if cerr != nil {
			return "", cerr
		}
		return path, nil
	}
}

// readBackupHeader parses the comment header; files without one (copied in by
// hand, or from an older layout) are skipped by the list.
func readBackupHeader(path string) (ResourceBackup, bool) {
	f, err := os.Open(path)
	if err != nil {
		return ResourceBackup{}, false
	}
	defer func() { _ = f.Close() }()
	sc := bufio.NewScanner(f)
	if !sc.Scan() || sc.Text() != backupHeaderStart {
		return ResourceBackup{}, false
	}
	b := ResourceBackup{File: filepath.Base(path)}
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "# ") {
			break
		}
		key, value, ok := strings.Cut(strings.TrimPrefix(line, "# "), ": ")
		if !ok {
			continue
		}
		switch key {
		case "context":
			b.Context = value
		case "kind":
			b.Kind = value
		case "namespace":
			b.Namespace = value
		case "name":
			b.Name = value
		case "taken":
			b.TakenAt = value
		}
	}
	return b, b.Kind != "" && b.Name != ""
}

// listResourceBackups returns the backups of one object in one context,
// newest first. A missing directory just means nothing was backed up yet.
func listResourceBackups(dir, contextName, kind, namespace, name string) ([]ResourceBackup, error) {
	entries, err := os.ReadDir(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return []ResourceBackup{}, nil
	}
	if err != nil {
		return nil, err
	}
	prefix := backupFileStem(name, kind) + "-"
	out := []ResourceBackup{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasPrefix(e.Name(), prefix) || !strings.HasSuffix(e.Name(), ".yaml") {
			continue
		}
		b, ok := readBackupHeader(filepath.Join(dir, e.Name()))
		if !ok || b.Context != contextName || !strings.EqualFold(b.Kind, kind) || b.Name != name || b.Namespace != namespace {
			continue
		}
		out = append(out, b)
	}
	// Newest first by the recorded time; RFC 3339 strings from different
	// offsets do not compare as text, so parse them.
	takenAt := func(b ResourceBackup) time.Time {
		t, _ := time.Parse(time.RFC3339Nano, b.TakenAt)
		return t
	}
	sort.SliceStable(out, func(i, j int) bool {
		if ti, tj := takenAt(out[i]), takenAt(out[j]); !ti.Equal(tj) {
			return ti.After(tj)
		}
		return out[i].File > out[j].File
	})
	return out, nil
}

// readResourceBackup returns a backup's manifest without the header. file is
// a bare file name from the list; anything that could reach outside the
// backup directory is refused.
func readResourceBackup(dir, file string) (string, error) {
	if file == "" || file != filepath.Base(file) || !strings.HasSuffix(file, ".yaml") {
		return "", fmt.Errorf("invalid backup file %q", file)
	}
	data, err := os.ReadFile(filepath.Join(dir, file))
	if err != nil {
		return "", err
	}
	lines := strings.SplitAfter(string(data), "\n")
	i := 0
	if len(lines) > 0 && strings.TrimRight(lines[0], "\n") == backupHeaderStart {
		for i = 1; i < len(lines) && strings.HasPrefix(lines[i], "# "); i++ {
		}
	}
	return strings.Join(lines[i:], ""), nil
}

func (m *ClientManager) backupDirectory() (string, error) {
	if m.backupDir != "" {
		return m.backupDir, nil
	}
	return defaultBackupDir()
}

// ListResourceBackups lists the saved copies of one object taken in the given
// context, newest first. Other clusters' copies of a same-named object are
// left out so a restore cannot pick up another cluster's manifest by mistake.
func (m *ClientManager) ListResourceBackups(contextName, kind, namespace, name string) ([]ResourceBackup, error) {
	dir, err := m.backupDirectory()
	if err != nil {
		return nil, err
	}
	return listResourceBackups(dir, contextName, kind, namespace, name)
}

// ReadResourceBackup returns the manifest stored in a backup file.
func (m *ClientManager) ReadResourceBackup(file string) (string, error) {
	dir, err := m.backupDirectory()
	if err != nil {
		return "", err
	}
	return readResourceBackup(dir, file)
}
