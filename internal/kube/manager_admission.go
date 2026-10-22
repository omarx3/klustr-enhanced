package kube

import "fmt"

func (m *ClientManager) ValidatingWebhookConfigurations(contextName string) []WebhookConfigurationInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []WebhookConfigurationInfo{}
	}
	return w.ValidatingWebhookConfigurations()
}

func (m *ClientManager) ValidatingWebhookConfiguration(contextName, name string) (*WebhookConfigurationDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ValidatingWebhookConfiguration(name)
}

func (m *ClientManager) MutatingWebhookConfigurations(contextName string) []WebhookConfigurationInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []WebhookConfigurationInfo{}
	}
	return w.MutatingWebhookConfigurations()
}

func (m *ClientManager) MutatingWebhookConfiguration(contextName, name string) (*WebhookConfigurationDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.MutatingWebhookConfiguration(name)
}

func (m *ClientManager) ValidatingAdmissionPolicies(contextName string) []AdmissionPolicyInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []AdmissionPolicyInfo{}
	}
	return w.ValidatingAdmissionPolicies()
}

func (m *ClientManager) ValidatingAdmissionPolicy(contextName, name string) (*AdmissionPolicyDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ValidatingAdmissionPolicy(name)
}

func (m *ClientManager) ValidatingAdmissionPolicyBindings(contextName string) []AdmissionPolicyBindingInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []AdmissionPolicyBindingInfo{}
	}
	return w.ValidatingAdmissionPolicyBindings()
}

func (m *ClientManager) ValidatingAdmissionPolicyBinding(contextName, name string) (*AdmissionPolicyBindingDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ValidatingAdmissionPolicyBinding(name)
}

func (m *ClientManager) MutatingAdmissionPolicies(contextName string) []AdmissionPolicyInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []AdmissionPolicyInfo{}
	}
	return w.MutatingAdmissionPolicies()
}

func (m *ClientManager) MutatingAdmissionPolicy(contextName, name string) (*AdmissionPolicyDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.MutatingAdmissionPolicy(name)
}

func (m *ClientManager) MutatingAdmissionPolicyBindings(contextName string) []AdmissionPolicyBindingInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []AdmissionPolicyBindingInfo{}
	}
	return w.MutatingAdmissionPolicyBindings()
}

func (m *ClientManager) MutatingAdmissionPolicyBinding(contextName, name string) (*AdmissionPolicyBindingDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.MutatingAdmissionPolicyBinding(name)
}
