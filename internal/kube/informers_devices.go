package kube

import (
	"sort"
	"time"

	resourcev1 "k8s.io/api/resource/v1"
	"k8s.io/apimachinery/pkg/labels"
)

type DeviceClassInfo struct {
	Name      string `json:"name"`
	Selectors int    `json:"selectors"`
	Config    int    `json:"config"`
	CreatedAt string `json:"createdAt"`
}

type ResourceSliceInfo struct {
	Name      string `json:"name"`
	Driver    string `json:"driver"`
	Pool      string `json:"pool"`
	NodeName  string `json:"nodeName"`
	Devices   int    `json:"devices"`
	AllNodes  bool   `json:"allNodes"`
	CreatedAt string `json:"createdAt"`
}

type ResourceClaimInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Requests  int    `json:"requests"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
}

type ResourceClaimTemplateInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Requests  int    `json:"requests"`
	CreatedAt string `json:"createdAt"`
}

func (w *contextWatcher) DeviceClasses() []DeviceClassInfo {
	f := w.factoryFor("DeviceClass")
	if f == nil {
		return []DeviceClassInfo{}
	}
	items, err := f.Resource().V1().DeviceClasses().Lister().List(labels.Everything())
	if err != nil {
		return []DeviceClassInfo{}
	}
	out := make([]DeviceClassInfo, 0, len(items))
	for _, c := range items {
		out = append(out, DeviceClassInfo{
			Name:      c.Name,
			Selectors: len(c.Spec.Selectors),
			Config:    len(c.Spec.Config),
			CreatedAt: c.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) ResourceSlices() []ResourceSliceInfo {
	f := w.factoryFor("ResourceSlice")
	if f == nil {
		return []ResourceSliceInfo{}
	}
	items, err := f.Resource().V1().ResourceSlices().Lister().List(labels.Everything())
	if err != nil {
		return []ResourceSliceInfo{}
	}
	out := make([]ResourceSliceInfo, 0, len(items))
	for _, s := range items {
		node := ""
		if s.Spec.NodeName != nil {
			node = *s.Spec.NodeName
		}
		all := false
		if s.Spec.AllNodes != nil {
			all = *s.Spec.AllNodes
		}
		out = append(out, ResourceSliceInfo{
			Name:      s.Name,
			Driver:    s.Spec.Driver,
			Pool:      s.Spec.Pool.Name,
			NodeName:  node,
			Devices:   len(s.Spec.Devices),
			AllNodes:  all,
			CreatedAt: s.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func resourceClaimStatusString(c *resourcev1.ResourceClaim) string {
	if c.Status.Allocation != nil {
		if len(c.Status.ReservedFor) > 0 {
			return "Reserved"
		}
		return "Allocated"
	}
	return "Pending"
}

func (w *contextWatcher) ResourceClaims(namespace string) []ResourceClaimInfo {
	f := w.factoryFor("ResourceClaim")
	if f == nil {
		return []ResourceClaimInfo{}
	}
	lister := f.Resource().V1().ResourceClaims().Lister()
	var (
		items []*resourcev1.ResourceClaim
		err   error
	)
	if namespace == "" {
		items, err = lister.List(labels.Everything())
	} else {
		items, err = lister.ResourceClaims(namespace).List(labels.Everything())
	}
	if err != nil {
		return []ResourceClaimInfo{}
	}
	out := make([]ResourceClaimInfo, 0, len(items))
	for _, c := range items {
		out = append(out, ResourceClaimInfo{
			Name:      c.Name,
			Namespace: c.Namespace,
			Requests:  len(c.Spec.Devices.Requests),
			Status:    resourceClaimStatusString(c),
			CreatedAt: c.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (w *contextWatcher) ResourceClaimTemplates(namespace string) []ResourceClaimTemplateInfo {
	f := w.factoryFor("ResourceClaimTemplate")
	if f == nil {
		return []ResourceClaimTemplateInfo{}
	}
	lister := f.Resource().V1().ResourceClaimTemplates().Lister()
	var (
		items []*resourcev1.ResourceClaimTemplate
		err   error
	)
	if namespace == "" {
		items, err = lister.List(labels.Everything())
	} else {
		items, err = lister.ResourceClaimTemplates(namespace).List(labels.Everything())
	}
	if err != nil {
		return []ResourceClaimTemplateInfo{}
	}
	out := make([]ResourceClaimTemplateInfo, 0, len(items))
	for _, c := range items {
		out = append(out, ResourceClaimTemplateInfo{
			Name:      c.Name,
			Namespace: c.Namespace,
			Requests:  len(c.Spec.Spec.Devices.Requests),
			CreatedAt: c.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}
