package kube

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"sort"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/api/equality"
	"k8s.io/client-go/tools/clientcmd"
)

// MergedKubeconfig reports what MergeKubeconfig added, so the UI can say
// which contexts are new and where the backup is.
type MergedKubeconfig struct {
	Contexts []string `json:"contexts"`
	Clusters []string `json:"clusters"`
	Users    []string `json:"users"`
	File     string   `json:"file"`
	// Backup is empty when the file did not exist before.
	Backup string `json:"backup"`
}

// MergeKubeconfig adds the contexts, clusters and users of a pasted
// kubeconfig to the user's default kubeconfig file, after a timestamped
// backup. Existing entries are never overwritten: an identical one is
// skipped, a different one under the same name fails the whole merge so
// nothing is half-applied. current-context is left unchanged.
func (m *ClientManager) MergeKubeconfig(content string) (*MergedKubeconfig, error) {
	m.mu.Lock()
	rules := *m.rules
	m.mu.Unlock()
	// See DeleteKubeconfigContext: ModifyConfig rewrites whole files.
	rules.DoNotResolvePaths = true

	backupDir, err := kubeconfigBackupDir()
	if err != nil {
		return nil, err
	}
	out, err := mergeIntoConfig(&rules, content, backupDir, time.Now())
	if err != nil {
		return nil, err
	}
	m.emitContextsChanged()
	return out, nil
}

func mergeIntoConfig(access clientcmd.ConfigAccess, content, backupDir string, now time.Time) (*MergedKubeconfig, error) {
	if strings.TrimSpace(content) == "" {
		return nil, fmt.Errorf("the pasted kubeconfig is empty")
	}
	incoming, err := clientcmd.Load([]byte(content))
	if err != nil {
		return nil, fmt.Errorf("parsing the pasted kubeconfig: %w", err)
	}
	if len(incoming.Contexts) == 0 {
		return nil, fmt.Errorf("the pasted kubeconfig has no contexts")
	}
	for name, c := range incoming.Contexts {
		if _, ok := incoming.Clusters[c.Cluster]; !ok {
			return nil, fmt.Errorf("context %q refers to cluster %q, which is not in the pasted kubeconfig", name, c.Cluster)
		}
		if _, ok := incoming.AuthInfos[c.AuthInfo]; !ok {
			return nil, fmt.Errorf("context %q refers to user %q, which is not in the pasted kubeconfig", name, c.AuthInfo)
		}
	}

	start, err := access.GetStartingConfig()
	if err != nil {
		return nil, err
	}
	next := start.DeepCopy()
	file := access.GetDefaultFilename()
	out := &MergedKubeconfig{Contexts: []string{}, Clusters: []string{}, Users: []string{}, File: file}

	var conflicts []string
	for name, c := range incoming.Clusters {
		if cur, ok := next.Clusters[name]; ok {
			c.LocationOfOrigin = cur.LocationOfOrigin
			if !equality.Semantic.DeepEqual(cur, c) {
				conflicts = append(conflicts, "cluster "+name)
			}
			continue
		}
		c.LocationOfOrigin = ""
		next.Clusters[name] = c
		out.Clusters = append(out.Clusters, name)
	}
	for name, u := range incoming.AuthInfos {
		if cur, ok := next.AuthInfos[name]; ok {
			u.LocationOfOrigin = cur.LocationOfOrigin
			if !equality.Semantic.DeepEqual(cur, u) {
				conflicts = append(conflicts, "user "+name)
			}
			continue
		}
		u.LocationOfOrigin = ""
		next.AuthInfos[name] = u
		out.Users = append(out.Users, name)
	}
	for name, c := range incoming.Contexts {
		if cur, ok := next.Contexts[name]; ok {
			c.LocationOfOrigin = cur.LocationOfOrigin
			if !equality.Semantic.DeepEqual(cur, c) {
				conflicts = append(conflicts, "context "+name)
			}
			continue
		}
		c.LocationOfOrigin = ""
		next.Contexts[name] = c
		out.Contexts = append(out.Contexts, name)
	}
	if len(conflicts) > 0 {
		sort.Strings(conflicts)
		return nil, fmt.Errorf("already in your kubeconfig with different settings: %s. Rename them in the pasted file and try again", strings.Join(conflicts, ", "))
	}
	if len(out.Contexts)+len(out.Clusters)+len(out.Users) == 0 {
		return nil, fmt.Errorf("everything in the pasted kubeconfig is already in your kubeconfig")
	}
	sort.Strings(out.Contexts)
	sort.Strings(out.Clusters)
	sort.Strings(out.Users)

	if _, err := os.Stat(file); err == nil {
		backup, err := backupFile(file, backupDir, now.Format("20060102-150405"))
		if err != nil {
			return nil, fmt.Errorf("backing up %s: %w", file, err)
		}
		out.Backup = backup
	} else if !errors.Is(err, fs.ErrNotExist) {
		return nil, err
	}
	if err := clientcmd.ModifyConfig(access, *next, false); err != nil {
		return nil, err
	}
	return out, nil
}
