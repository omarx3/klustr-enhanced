package kube

import (
	"os"

	clientfeatures "k8s.io/client-go/features"
)

// client-go 1.35+ defaults WatchListClient on: an informer's first load becomes
// a streaming watch that waits for an initial-events bookmark. Some managed
// apiservers (seen on GKE 1.35) never deliver it in time, and every informer
// stalls in 10 s bookmark-expired retries before falling back to a LIST, which
// turned a ~5 s Nodes view into ~30 s and left Pods empty for minutes. A plain
// paginated LIST works everywhere, so the gate defaults off here. Setting
// KUBE_FEATURE_WatchListClient explicitly still wins.
type klustrFeatureGates struct{ base clientfeatures.Gates }

func (g klustrFeatureGates) Enabled(key clientfeatures.Feature) bool {
	if key == clientfeatures.WatchListClient {
		if _, set := os.LookupEnv("KUBE_FEATURE_" + string(key)); !set {
			return false
		}
	}
	return g.base.Enabled(key)
}

func init() {
	clientfeatures.ReplaceFeatureGates(klustrFeatureGates{base: clientfeatures.FeatureGates()})
}
