package kube

import (
	"context"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// DeploymentStatus is what a deployment monitor compares between checks.
type DeploymentStatus struct {
	Replicas int32    `json:"replicas"`
	Ready    int32    `json:"ready"`
	Images   []string `json:"images"`
}

// monitorTimeout bounds one check so an unreachable cluster cannot pile up
// requests across the one-minute interval.
const monitorTimeout = 20 * time.Second

// DeploymentStatus reads one deployment straight from the API server rather
// than from an informer, so a monitor keeps working for contexts that are not
// being watched (switching clusters stops the previous context's watch).
func (m *ClientManager) DeploymentStatus(ctx context.Context, contextName, namespace, name string) (*DeploymentStatus, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return nil, err
	}
	return deploymentStatus(ctx, cs, namespace, name)
}

func deploymentStatus(ctx context.Context, cs kubernetes.Interface, namespace, name string) (*DeploymentStatus, error) {
	ctx, cancel := context.WithTimeout(ctx, monitorTimeout)
	defer cancel()
	d, err := cs.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return statusOf(d), nil
}

func statusOf(d *appsv1.Deployment) *DeploymentStatus {
	out := &DeploymentStatus{Ready: d.Status.ReadyReplicas, Images: []string{}}
	// An unset replicas field means the API default of 1.
	out.Replicas = 1
	if d.Spec.Replicas != nil {
		out.Replicas = *d.Spec.Replicas
	}
	for _, c := range d.Spec.Template.Spec.Containers {
		out.Images = append(out.Images, c.Image)
	}
	return out
}

// DeploymentRef names one deployment for the monitor picker.
type DeploymentRef struct {
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

// DeploymentNames lists every deployment in the context the user can see,
// read from the API so it works without an active watch. A user without
// cluster-wide list falls back to the kubeconfig namespace.
func (m *ClientManager) DeploymentNames(ctx context.Context, contextName string) ([]DeploymentRef, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return nil, err
	}
	refs, err := deploymentNames(ctx, cs, metav1.NamespaceAll)
	if err == nil || !apierrors.IsForbidden(err) {
		return refs, err
	}
	m.mu.Lock()
	rules := m.rules
	m.mu.Unlock()
	ns, _, nsErr := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		rules, &clientcmd.ConfigOverrides{CurrentContext: contextName}).Namespace()
	if nsErr != nil {
		return nil, err
	}
	return deploymentNames(ctx, cs, ns)
}

func deploymentNames(ctx context.Context, cs kubernetes.Interface, namespace string) ([]DeploymentRef, error) {
	ctx, cancel := context.WithTimeout(ctx, monitorTimeout)
	defer cancel()
	list, err := cs.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]DeploymentRef, 0, len(list.Items))
	for i := range list.Items {
		out = append(out, DeploymentRef{Namespace: list.Items[i].Namespace, Name: list.Items[i].Name})
	}
	return out, nil
}
