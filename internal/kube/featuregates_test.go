package kube

import (
	"os"
	"testing"

	clientfeatures "k8s.io/client-go/features"
)

type fakeGates map[clientfeatures.Feature]bool

func (f fakeGates) Enabled(k clientfeatures.Feature) bool { return f[k] }

func TestWatchListClientOffUnlessEnvSet(t *testing.T) {
	if _, ok := os.LookupEnv("KUBE_FEATURE_WatchListClient"); ok {
		t.Skip("KUBE_FEATURE_WatchListClient set in the test environment")
	}
	g := klustrFeatureGates{base: fakeGates{clientfeatures.WatchListClient: true, clientfeatures.InformerResourceVersion: true}}
	if g.Enabled(clientfeatures.WatchListClient) {
		t.Fatal("WatchListClient must default off")
	}
	if !g.Enabled(clientfeatures.InformerResourceVersion) {
		t.Fatal("other gates must pass through")
	}
	if clientfeatures.FeatureGates().Enabled(clientfeatures.WatchListClient) {
		t.Fatal("package init must install the override")
	}

	t.Setenv("KUBE_FEATURE_WatchListClient", "true")
	if !g.Enabled(clientfeatures.WatchListClient) {
		t.Fatal("an explicit env setting must defer to client-go")
	}
}
