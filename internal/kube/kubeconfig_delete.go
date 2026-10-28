package kube

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"k8s.io/client-go/tools/clientcmd"
)

// DeletedContext reports what DeleteKubeconfigContext removed, so the UI can
// say exactly what changed and where the backup is.
type DeletedContext struct {
	Context string `json:"context"`
	// Cluster and User are set only when nothing else referenced them and
	// they were removed too; a shared entry is left in place.
	Cluster string `json:"cluster"`
	User    string `json:"user"`
	// Files the change was written to, and a backup of each taken first.
	Files   []string `json:"files"`
	Backups []string `json:"backups"`
}

// DeleteKubeconfigContext removes a context from the user's kubeconfig, the
// way `kubectl config delete-context` does, plus its cluster and user entries
// when no other context still uses them. Each entry is removed from the file
// it came from (KUBECONFIG may list several), under client-go's file lock,
// after a timestamped backup of every file that will change. A watch on the
// context is stopped first so nothing keeps using the removed credentials.
func (m *ClientManager) DeleteKubeconfigContext(contextName string) (*DeletedContext, error) {
	m.mu.Lock()
	rules := *m.rules
	m.mu.Unlock()
	// Paths must stay as written in the files: ModifyConfig rewrites whole
	// files, and resolved absolute paths would replace the user's relative
	// certificate paths.
	rules.DoNotResolvePaths = true

	backupDir, err := kubeconfigBackupDir()
	if err != nil {
		return nil, err
	}
	out, err := deleteContextFromConfig(&rules, contextName, backupDir, time.Now())
	if err != nil {
		return nil, err
	}
	m.StopWatch(contextName)
	// StopWatch leaves exec sessions running; none may outlive the
	// credentials they were opened with.
	m.execs.stopForContext(contextName)
	m.mu.Lock()
	delete(m.cache, contextName)
	delete(m.readOnly, contextName)
	m.mu.Unlock()
	m.emitContextsChanged()
	return out, nil
}

func deleteContextFromConfig(access clientcmd.ConfigAccess, contextName, backupDir string, now time.Time) (*DeletedContext, error) {
	if contextName == "" {
		return nil, fmt.Errorf("no context name given")
	}
	start, err := access.GetStartingConfig()
	if err != nil {
		return nil, err
	}
	ctx, ok := start.Contexts[contextName]
	if !ok {
		return nil, fmt.Errorf("context %q is not in the kubeconfig", contextName)
	}

	next := start.DeepCopy()
	delete(next.Contexts, contextName)
	out := &DeletedContext{Context: contextName, Files: []string{}, Backups: []string{}}
	files := map[string]bool{originOf(ctx.LocationOfOrigin, access): true}

	clusterUsed, userUsed := false, false
	for _, c := range next.Contexts {
		clusterUsed = clusterUsed || c.Cluster == ctx.Cluster
		userUsed = userUsed || c.AuthInfo == ctx.AuthInfo
	}
	if cl, ok := next.Clusters[ctx.Cluster]; ok && !clusterUsed {
		files[originOf(cl.LocationOfOrigin, access)] = true
		delete(next.Clusters, ctx.Cluster)
		out.Cluster = ctx.Cluster
	}
	if u, ok := next.AuthInfos[ctx.AuthInfo]; ok && !userUsed {
		files[originOf(u.LocationOfOrigin, access)] = true
		delete(next.AuthInfos, ctx.AuthInfo)
		out.User = ctx.AuthInfo
	}
	if next.CurrentContext == contextName {
		// current-context always lives in the default file.
		next.CurrentContext = ""
		files[access.GetDefaultFilename()] = true
	}

	stamp := now.Format("20060102-150405")
	for f := range files {
		backup, err := backupFile(f, backupDir, stamp)
		if err != nil {
			return nil, fmt.Errorf("backing up %s: %w", f, err)
		}
		out.Files = append(out.Files, f)
		out.Backups = append(out.Backups, backup)
	}
	if err := clientcmd.ModifyConfig(access, *next, false); err != nil {
		return nil, err
	}
	return out, nil
}

func originOf(location string, access clientcmd.ConfigAccess) string {
	if location == "" {
		return access.GetDefaultFilename()
	}
	return location
}

// kubeconfigBackupDir is where kubeconfig backups go: Klustr's own config
// directory (~/.config/klustr on Linux), so they do not pile up in ~/.kube.
func kubeconfigBackupDir() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "klustr"), nil
}

// backupFile copies path to "<dir>/<name>.klustr-backup-<stamp>" with the
// same permissions, since a kubeconfig holds credentials.
func backupFile(path, dir, stamp string) (string, error) {
	src, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer func() { _ = src.Close() }()
	info, err := src.Stat()
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	// KUBECONFIG can list several files with the same name in different
	// directories; all their backups land in one directory, so a taken name
	// gets a counter instead of failing the whole change.
	base := filepath.Join(dir, fmt.Sprintf("%s.klustr-backup-%s", filepath.Base(path), stamp))
	dst := base
	var f *os.File
	for i := 2; ; i++ {
		f, err = os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_EXCL, info.Mode().Perm())
		if err == nil {
			break
		}
		if !os.IsExist(err) || i > 100 {
			return "", err
		}
		dst = fmt.Sprintf("%s-%d", base, i)
	}
	if _, err := io.Copy(f, src); err != nil {
		_ = f.Close()
		_ = os.Remove(dst)
		return "", err
	}
	if err := f.Close(); err != nil {
		return "", err
	}
	return filepath.Clean(dst), nil
}
