package kube

import (
	"context"
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"sigs.k8s.io/yaml"
)

// CreatedResource identifies what CreateResourceYAML made, so the UI can open
// it. Namespace is "" for cluster-scoped kinds.
type CreatedResource struct {
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

// CreateResourceYAML creates one object from a manifest. Unlike
// ApplyResourceYAML it is a POST, so a name that already exists fails with
// AlreadyExists instead of silently overwriting the live object: a template
// is a new resource. dryRun runs the same request with DryRun=All, which
// surfaces schema, admission and quota errors without writing anything.
func (m *ClientManager) CreateResourceYAML(ctx context.Context, contextName, yamlBody string, dryRun bool) (*CreatedResource, error) {
	if !dryRun {
		if err := m.assertWritable(contextName); err != nil {
			return nil, err
		}
	}
	obj, err := decodeSingleManifest(yamlBody)
	if err != nil {
		return nil, err
	}
	gvr, err := m.resolveGVK(contextName, obj.GroupVersionKind())
	if err != nil {
		return nil, err
	}
	dyn, err := m.dynamicClient(contextName)
	if err != nil {
		return nil, err
	}
	opts := metav1.CreateOptions{FieldManager: "klustr"}
	if dryRun {
		opts.DryRun = []string{metav1.DryRunAll}
	}
	created, err := resourceFor(dyn, gvr, obj.GetNamespace()).Create(ctx, obj, opts)
	if err != nil {
		return nil, err
	}
	return &CreatedResource{Kind: created.GetKind(), Namespace: created.GetNamespace(), Name: created.GetName()}, nil
}

// decodeSingleManifest parses exactly one object and checks the fields every
// create needs. A second document is refused rather than silently dropped.
func decodeSingleManifest(body string) (*unstructured.Unstructured, error) {
	if docs := splitYAMLDocuments(body); len(docs) > 1 {
		return nil, fmt.Errorf("found %d YAML documents; create one resource at a time", len(docs))
	}
	obj := &unstructured.Unstructured{}
	if err := yaml.Unmarshal([]byte(body), &obj.Object); err != nil {
		return nil, fmt.Errorf("invalid YAML: %w", err)
	}
	if obj.Object == nil {
		return nil, fmt.Errorf("manifest is empty")
	}
	switch {
	case obj.GetAPIVersion() == "":
		return nil, fmt.Errorf("manifest is missing apiVersion")
	case obj.GetKind() == "":
		return nil, fmt.Errorf("manifest is missing kind")
	case obj.GetName() == "" && obj.GetGenerateName() == "":
		return nil, fmt.Errorf("manifest is missing metadata.name")
	}
	return obj, nil
}

// splitYAMLDocuments returns the non-empty documents of a multi-document
// stream. A leading "---" or trailing separator does not count as a document.
func splitYAMLDocuments(body string) []string {
	var docs []string
	var cur []string
	flush := func() {
		text := strings.TrimSpace(strings.Join(cur, "\n"))
		if text != "" && !onlyComments(text) {
			docs = append(docs, text)
		}
		cur = cur[:0]
	}
	for _, line := range strings.Split(body, "\n") {
		if strings.TrimRight(line, " \t\r") == "---" {
			flush()
			continue
		}
		cur = append(cur, line)
	}
	flush()
	return docs
}

func onlyComments(text string) bool {
	for _, line := range strings.Split(text, "\n") {
		t := strings.TrimSpace(line)
		if t != "" && !strings.HasPrefix(t, "#") {
			return false
		}
	}
	return true
}
