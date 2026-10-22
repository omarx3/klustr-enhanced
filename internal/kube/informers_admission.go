package kube

import (
	"sort"
	"strings"
	"time"

	admissionregv1 "k8s.io/api/admissionregistration/v1"
	"k8s.io/apimachinery/pkg/labels"
)

type WebhookConfigurationInfo struct {
	Name      string `json:"name"`
	Webhooks  int    `json:"webhooks"`
	CreatedAt string `json:"createdAt"`
}

func (w *contextWatcher) ValidatingWebhookConfigurations() []WebhookConfigurationInfo {
	f := w.factoryFor("ValidatingWebhookConfiguration")
	if f == nil {
		return []WebhookConfigurationInfo{}
	}
	whs, err := f.Admissionregistration().V1().ValidatingWebhookConfigurations().Lister().List(labels.Everything())
	if err != nil {
		return []WebhookConfigurationInfo{}
	}
	out := make([]WebhookConfigurationInfo, 0, len(whs))
	for _, c := range whs {
		out = append(out, WebhookConfigurationInfo{
			Name:      c.Name,
			Webhooks:  len(c.Webhooks),
			CreatedAt: c.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

type AdmissionPolicyInfo struct {
	Name        string `json:"name"`
	FailPolicy  string `json:"failPolicy"`
	ParamKind   string `json:"paramKind"`
	Validations int    `json:"validations"`
	Mutations   int    `json:"mutations"`
	CreatedAt   string `json:"createdAt"`
}

type AdmissionPolicyBindingInfo struct {
	Name       string `json:"name"`
	PolicyName string `json:"policyName"`
	ParamRef   string `json:"paramRef"`
	Actions    string `json:"actions"`
	CreatedAt  string `json:"createdAt"`
}

func paramKindString(p *admissionregv1.ParamKind) string {
	if p == nil {
		return ""
	}
	return p.APIVersion + "/" + p.Kind
}

func paramRefString(r *admissionregv1.ParamRef) string {
	if r == nil {
		return ""
	}
	if r.Name != "" {
		if r.Namespace != "" {
			return r.Namespace + "/" + r.Name
		}
		return r.Name
	}
	if r.Selector != nil {
		return "selector:" + formatLabelSelector(r.Selector)
	}
	return ""
}

func (w *contextWatcher) ValidatingAdmissionPolicies() []AdmissionPolicyInfo {
	f := w.factoryFor("ValidatingAdmissionPolicy")
	if f == nil {
		return []AdmissionPolicyInfo{}
	}
	items, err := f.Admissionregistration().V1().ValidatingAdmissionPolicies().Lister().List(labels.Everything())
	if err != nil {
		return []AdmissionPolicyInfo{}
	}
	out := make([]AdmissionPolicyInfo, 0, len(items))
	for _, p := range items {
		fail := ""
		if p.Spec.FailurePolicy != nil {
			fail = string(*p.Spec.FailurePolicy)
		}
		out = append(out, AdmissionPolicyInfo{
			Name:        p.Name,
			FailPolicy:  fail,
			ParamKind:   paramKindString(p.Spec.ParamKind),
			Validations: len(p.Spec.Validations),
			CreatedAt:   p.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) ValidatingAdmissionPolicyBindings() []AdmissionPolicyBindingInfo {
	f := w.factoryFor("ValidatingAdmissionPolicyBinding")
	if f == nil {
		return []AdmissionPolicyBindingInfo{}
	}
	items, err := f.Admissionregistration().V1().ValidatingAdmissionPolicyBindings().Lister().List(labels.Everything())
	if err != nil {
		return []AdmissionPolicyBindingInfo{}
	}
	out := make([]AdmissionPolicyBindingInfo, 0, len(items))
	for _, b := range items {
		actions := make([]string, 0, len(b.Spec.ValidationActions))
		for _, a := range b.Spec.ValidationActions {
			actions = append(actions, string(a))
		}
		out = append(out, AdmissionPolicyBindingInfo{
			Name:       b.Name,
			PolicyName: b.Spec.PolicyName,
			ParamRef:   paramRefString(b.Spec.ParamRef),
			Actions:    strings.Join(actions, ","),
			CreatedAt:  b.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) MutatingAdmissionPolicies() []AdmissionPolicyInfo {
	f := w.factoryFor("MutatingAdmissionPolicy")
	if f == nil {
		return []AdmissionPolicyInfo{}
	}
	items, err := f.Admissionregistration().V1().MutatingAdmissionPolicies().Lister().List(labels.Everything())
	if err != nil {
		return []AdmissionPolicyInfo{}
	}
	out := make([]AdmissionPolicyInfo, 0, len(items))
	for _, p := range items {
		fail := ""
		if p.Spec.FailurePolicy != nil {
			fail = string(*p.Spec.FailurePolicy)
		}
		out = append(out, AdmissionPolicyInfo{
			Name:       p.Name,
			FailPolicy: fail,
			ParamKind:  paramKindString(p.Spec.ParamKind),
			Mutations:  len(p.Spec.Mutations),
			CreatedAt:  p.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) MutatingAdmissionPolicyBindings() []AdmissionPolicyBindingInfo {
	f := w.factoryFor("MutatingAdmissionPolicyBinding")
	if f == nil {
		return []AdmissionPolicyBindingInfo{}
	}
	items, err := f.Admissionregistration().V1().MutatingAdmissionPolicyBindings().Lister().List(labels.Everything())
	if err != nil {
		return []AdmissionPolicyBindingInfo{}
	}
	out := make([]AdmissionPolicyBindingInfo, 0, len(items))
	for _, b := range items {
		out = append(out, AdmissionPolicyBindingInfo{
			Name:       b.Name,
			PolicyName: b.Spec.PolicyName,
			ParamRef:   paramRefString(b.Spec.ParamRef),
			CreatedAt:  b.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (w *contextWatcher) MutatingWebhookConfigurations() []WebhookConfigurationInfo {
	f := w.factoryFor("MutatingWebhookConfiguration")
	if f == nil {
		return []WebhookConfigurationInfo{}
	}
	whs, err := f.Admissionregistration().V1().MutatingWebhookConfigurations().Lister().List(labels.Everything())
	if err != nil {
		return []WebhookConfigurationInfo{}
	}
	out := make([]WebhookConfigurationInfo, 0, len(whs))
	for _, c := range whs {
		out = append(out, WebhookConfigurationInfo{
			Name:      c.Name,
			Webhooks:  len(c.Webhooks),
			CreatedAt: c.CreationTimestamp.UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}
