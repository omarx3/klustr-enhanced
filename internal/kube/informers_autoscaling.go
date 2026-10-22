package kube

import (
	"fmt"
	"strings"
	"time"

	autoscalingv2 "k8s.io/api/autoscaling/v2"
	policyv1 "k8s.io/api/policy/v1"
	"k8s.io/apimachinery/pkg/labels"
)

type PodDisruptionBudgetInfo struct {
	Name           string `json:"name"`
	Namespace      string `json:"namespace"`
	MinAvailable   string `json:"minAvailable"`
	MaxUnavailable string `json:"maxUnavailable"`
	CurrentHealthy int32  `json:"currentHealthy"`
	DesiredHealthy int32  `json:"desiredHealthy"`
	Allowed        int32  `json:"allowed"`
	CreatedAt      string `json:"createdAt"`
}

type HPAMetricTarget struct {
	Name    string `json:"name"`
	Current int32  `json:"current"`
	Target  int32  `json:"target"`
	// Text is the descriptive label of the metric origin (e.g. "external",
	// "pods/100", or for KEDA the enriched trigger label like
	// "prometheus (threshold=10)"). Stays separate from Reading so the
	// tooltip can render a clean 3-column [name | label | reading] grid.
	Text string `json:"text"`
	// Reading is the human-readable current/target pair when one is available
	// (e.g. "910m / 1" for an external metric, "55% / 75%" for a percent
	// Resource metric). Empty when the HPA hasn't reported a status reading.
	Reading string `json:"reading"`
	// Source tags the metric origin so the frontend can render distinct UIs —
	// "resource" gets a percent bar, "keda" collapses into a single KEDA badge
	// in the row with details deferred to the tooltip, and external/pods/object
	// render as text-only rows.
	Source string `json:"source"`
}

type HorizontalPodAutoscalerInfo struct {
	Name            string            `json:"name"`
	Namespace       string            `json:"namespace"`
	Reference       string            `json:"reference"`
	MinReplicas     int32             `json:"minReplicas"`
	MaxReplicas     int32             `json:"maxReplicas"`
	CurrentReplicas int32             `json:"currentReplicas"`
	Metrics         []HPAMetricTarget `json:"metrics"`
	CreatedAt       string            `json:"createdAt"`
}

func (w *contextWatcher) PodDisruptionBudgets(namespace string) []PodDisruptionBudgetInfo {
	f := w.factoryFor("PodDisruptionBudget")
	if f == nil {
		return []PodDisruptionBudgetInfo{}
	}
	lister := f.Policy().V1().PodDisruptionBudgets().Lister()
	var (
		pdbs []*policyv1.PodDisruptionBudget
		err  error
	)
	if namespace == "" {
		pdbs, err = lister.List(labels.Everything())
	} else {
		pdbs, err = lister.PodDisruptionBudgets(namespace).List(labels.Everything())
	}
	if err != nil {
		return []PodDisruptionBudgetInfo{}
	}
	out := make([]PodDisruptionBudgetInfo, 0, len(pdbs))
	for _, p := range pdbs {
		minAvail := ""
		if p.Spec.MinAvailable != nil {
			minAvail = p.Spec.MinAvailable.String()
		}
		maxUnavail := ""
		if p.Spec.MaxUnavailable != nil {
			maxUnavail = p.Spec.MaxUnavailable.String()
		}
		out = append(out, PodDisruptionBudgetInfo{
			Name:           p.Name,
			Namespace:      p.Namespace,
			MinAvailable:   minAvail,
			MaxUnavailable: maxUnavail,
			CurrentHealthy: p.Status.CurrentHealthy,
			DesiredHealthy: p.Status.DesiredHealthy,
			Allowed:        p.Status.DisruptionsAllowed,
			CreatedAt:      p.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) HorizontalPodAutoscalers(namespace string) []HorizontalPodAutoscalerInfo {
	f := w.factoryFor("HorizontalPodAutoscaler")
	if f == nil {
		return []HorizontalPodAutoscalerInfo{}
	}
	lister := f.Autoscaling().V2().HorizontalPodAutoscalers().Lister()
	var (
		hpas []*autoscalingv2.HorizontalPodAutoscaler
		err  error
	)
	if namespace == "" {
		hpas, err = lister.List(labels.Everything())
	} else {
		hpas, err = lister.HorizontalPodAutoscalers(namespace).List(labels.Everything())
	}
	if err != nil {
		return []HorizontalPodAutoscalerInfo{}
	}
	out := make([]HorizontalPodAutoscalerInfo, 0, len(hpas))
	for _, h := range hpas {
		var min int32 = 1
		if h.Spec.MinReplicas != nil {
			min = *h.Spec.MinReplicas
		}
		ref := h.Spec.ScaleTargetRef.Kind + "/" + h.Spec.ScaleTargetRef.Name
		out = append(out, HorizontalPodAutoscalerInfo{
			Name:            h.Name,
			Namespace:       h.Namespace,
			Reference:       ref,
			MinReplicas:     min,
			MaxReplicas:     h.Spec.MaxReplicas,
			CurrentReplicas: h.Status.CurrentReplicas,
			Metrics:         w.metricsForHPA(h),
			CreatedAt:       h.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

// metricsForHPA builds the per-metric current/target view and enriches it
// with KEDA trigger labels when the HPA is owned by a ScaledObject. Kept on
// contextWatcher so the enrichment can reach into the SO informer cache.
func (w *contextWatcher) metricsForHPA(h *autoscalingv2.HorizontalPodAutoscaler) []HPAMetricTarget {
	metrics := hpaMetricTargets(h)
	if soName := hpaOwnedByKEDA(h); soName != "" {
		if so, ok := w.scaledObjectByName(h.Namespace, soName); ok {
			metrics = enrichKEDAMetrics(metrics, so)
		}
	}
	return metrics
}

// hpaMetricTargets returns a structured per-metric current/target view.
// For Resource/Utilization metrics both Current and Target are populated
// as percentages, so the frontend can render a bar. Other metric kinds
// fall back to a human-readable Text field with Current == Target == -1.
func hpaMetricTargets(h *autoscalingv2.HorizontalPodAutoscaler) []HPAMetricTarget {
	out := make([]HPAMetricTarget, 0, len(h.Spec.Metrics))
	for _, spec := range h.Spec.Metrics {
		switch spec.Type {
		case autoscalingv2.ResourceMetricSourceType:
			if spec.Resource == nil {
				continue
			}
			name := string(spec.Resource.Name)
			cur := int32(-1)
			for _, st := range h.Status.CurrentMetrics {
				if st.Type != autoscalingv2.ResourceMetricSourceType || st.Resource == nil {
					continue
				}
				if string(st.Resource.Name) != name {
					continue
				}
				if st.Resource.Current.AverageUtilization != nil {
					cur = *st.Resource.Current.AverageUtilization
				}
				break
			}
			if spec.Resource.Target.Type == autoscalingv2.UtilizationMetricType && spec.Resource.Target.AverageUtilization != nil {
				reading := ""
				if cur >= 0 {
					reading = fmt.Sprintf("%d%% / %d%%", cur, *spec.Resource.Target.AverageUtilization)
				}
				out = append(out, HPAMetricTarget{
					Name:    name,
					Current: cur,
					Target:  *spec.Resource.Target.AverageUtilization,
					Reading: reading,
					Source:  "resource",
				})
				continue
			}
			out = append(out, HPAMetricTarget{
				Name:    name,
				Current: -1,
				Target:  -1,
				Text:    "resource",
				Reading: hpaMetricTargetText(spec.Resource.Target),
				Source:  "resource",
			})
		case autoscalingv2.ExternalMetricSourceType:
			if spec.External == nil {
				continue
			}
			out = append(out, HPAMetricTarget{
				Name:    spec.External.Metric.Name,
				Current: -1,
				Target:  -1,
				Text:    "external",
				Reading: hpaExternalReading(spec.External, h),
				Source:  "external",
			})
		case autoscalingv2.PodsMetricSourceType:
			if spec.Pods == nil {
				continue
			}
			out = append(out, HPAMetricTarget{
				Name:    spec.Pods.Metric.Name,
				Current: -1,
				Target:  -1,
				Text:    "pods",
				Reading: hpaMetricTargetText(spec.Pods.Target),
				Source:  "pods",
			})
		case autoscalingv2.ObjectMetricSourceType:
			if spec.Object == nil {
				continue
			}
			out = append(out, HPAMetricTarget{
				Name:    spec.Object.Metric.Name,
				Current: -1,
				Target:  -1,
				Text:    "object",
				Reading: hpaMetricTargetText(spec.Object.Target),
				Source:  "object",
			})
		default:
			out = append(out, HPAMetricTarget{
				Name:    strings.ToLower(string(spec.Type)),
				Current: -1,
				Target:  -1,
				Text:    string(spec.Type),
				Source:  "external",
			})
		}
	}
	return out
}

// hpaExternalReading renders an External metric's current/target as
// "<current> / <target>", falling back to just the target when the HPA hasn't
// reported a status reading yet.
func hpaExternalReading(spec *autoscalingv2.ExternalMetricSource, h *autoscalingv2.HorizontalPodAutoscaler) string {
	target := hpaMetricTargetText(spec.Target)
	for _, st := range h.Status.CurrentMetrics {
		if st.Type != autoscalingv2.ExternalMetricSourceType || st.External == nil {
			continue
		}
		if st.External.Metric.Name != spec.Metric.Name {
			continue
		}
		switch {
		case st.External.Current.AverageValue != nil:
			return fmt.Sprintf("%s / %s", st.External.Current.AverageValue.String(), target)
		case st.External.Current.Value != nil:
			return fmt.Sprintf("%s / %s", st.External.Current.Value.String(), target)
		}
		break
	}
	return target
}

func hpaMetricTargetText(t autoscalingv2.MetricTarget) string {
	switch t.Type {
	case autoscalingv2.UtilizationMetricType:
		if t.AverageUtilization != nil {
			return fmt.Sprintf("%d%%", *t.AverageUtilization)
		}
	case autoscalingv2.AverageValueMetricType:
		if t.AverageValue != nil {
			return t.AverageValue.String()
		}
	case autoscalingv2.ValueMetricType:
		if t.Value != nil {
			return t.Value.String()
		}
	}
	return "?"
}
