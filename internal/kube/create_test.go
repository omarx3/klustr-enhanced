package kube

import (
	"context"
	"strings"
	"testing"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
)

const serviceTemplate = `apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: apps
spec:
  selector:
    app: MyApp
  ports:
    - protocol: TCP
      port: 80
      targetPort: 9376
`

var servicesGVR = schema.GroupVersionResource{Version: "v1", Resource: "services"}

func createTestManager(objs ...runtime.Object) (*ClientManager, *dynamicfake.FakeDynamicClient) {
	dyn := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme(), objs...)
	return &ClientManager{
		watchers: map[string]*contextWatcher{"ctx": {dyn: dyn}},
		readOnly: map[string]bool{},
	}, dyn
}

func TestCreateResourceYAMLCreatesTheObject(t *testing.T) {
	m, dyn := createTestManager()
	got, err := m.CreateResourceYAML(context.Background(), "ctx", serviceTemplate, false)
	if err != nil {
		t.Fatal(err)
	}
	if *got != (CreatedResource{Kind: "Service", Namespace: "apps", Name: "my-service"}) {
		t.Fatalf("got %+v", *got)
	}
	live, err := dyn.Resource(servicesGVR).Namespace("apps").Get(context.Background(), "my-service", metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	port, _, _ := unstructured.NestedSlice(live.Object, "spec", "ports")
	if len(port) != 1 {
		t.Fatalf("ports = %v", port)
	}
}

func TestCreateResourceYAMLRefusesToOverwrite(t *testing.T) {
	existing := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "v1", "kind": "Service",
		"metadata": map[string]any{"name": "my-service", "namespace": "apps"},
	}}
	m, _ := createTestManager(existing)
	_, err := m.CreateResourceYAML(context.Background(), "ctx", serviceTemplate, false)
	if !apierrors.IsAlreadyExists(err) {
		t.Fatalf("err = %v, want AlreadyExists", err)
	}
}

func TestCreateResourceYAMLReadOnlyRefusesWritesButAllowsDryRun(t *testing.T) {
	m, dyn := createTestManager()
	m.readOnly["ctx"] = true
	if _, err := m.CreateResourceYAML(context.Background(), "ctx", serviceTemplate, false); err != errReadOnly {
		t.Fatalf("err = %v, want errReadOnly", err)
	}
	if len(dyn.Actions()) != 0 {
		t.Fatalf("read-only create reached the API: %v", dyn.Actions())
	}
	// Validation stays available read-only: a dry run never writes.
	if _, err := m.CreateResourceYAML(context.Background(), "ctx", serviceTemplate, true); err != nil {
		t.Fatalf("dry run in read-only mode: %v", err)
	}
}

func TestDecodeSingleManifestErrors(t *testing.T) {
	cases := map[string]string{
		"":                                     "empty",
		"kind: Service\nmetadata:\n  name: a":  "apiVersion",
		"apiVersion: v1\nmetadata:\n  name: a": "kind",
		"apiVersion: v1\nkind: Service\n":      "metadata.name",
		"apiVersion: v1\nkind: Service\nmetadata:\n\tname: a": "invalid YAML",
		serviceTemplate + "---\n" + serviceTemplate:           "2 YAML documents",
	}
	for body, want := range cases {
		_, err := decodeSingleManifest(body)
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("decode(%q) err = %v, want it to contain %q", body, err, want)
		}
	}
}

func TestDecodeSingleManifestIgnoresSeparatorsAndComments(t *testing.T) {
	body := "---\n# a comment\n" + serviceTemplate + "---\n# trailing\n"
	obj, err := decodeSingleManifest(body)
	if err != nil {
		t.Fatal(err)
	}
	if obj.GetName() != "my-service" {
		t.Fatalf("name = %q", obj.GetName())
	}
}
