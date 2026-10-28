package kube

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestDeploymentStatus(t *testing.T) {
	three := int32(3)
	cs := fake.NewSimpleClientset(&appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "web", Namespace: "prod", UID: "uid-1"},
		Spec: appsv1.DeploymentSpec{
			Replicas: &three,
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "web"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Annotations: map[string]string{restartedAtAnnotation: "2026-10-28T17:00:00Z"}},
				Spec: corev1.PodSpec{Containers: []corev1.Container{
					{Name: "app", Image: "nginx:1.25"},
					{Name: "sidecar", Image: "envoy:1.30"},
				}},
			},
		},
		Status: appsv1.DeploymentStatus{ReadyReplicas: 2},
	}, &appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "bare", Namespace: "prod"}},
		podWithRestarts("web-1", "web", 2, 1),
		podWithRestarts("web-2", "web", 4),
		podWithRestarts("other", "other", 9),
	)

	got, err := deploymentStatus(context.Background(), cs, "prod", "web")
	if err != nil {
		t.Fatal(err)
	}
	if !got.Exists || got.UID != "uid-1" || got.Replicas != 3 || got.Ready != 2 || len(got.Images) != 2 || got.Images[1] != "envoy:1.30" {
		t.Fatalf("unexpected status %+v", got)
	}
	if got.RestartedAt != "2026-10-28T17:00:00Z" || got.PodRestarts != 7 {
		t.Fatalf("restarts: %+v", got)
	}

	bare, err := deploymentStatus(context.Background(), cs, "prod", "bare")
	if err != nil {
		t.Fatal(err)
	}
	if bare.Replicas != 1 || bare.Images == nil {
		t.Fatalf("defaults not applied: %+v", bare)
	}

	gone, err := deploymentStatus(context.Background(), cs, "prod", "missing")
	if err != nil || gone.Exists || gone.Images == nil {
		t.Fatalf("deleted deployment: %+v %v", gone, err)
	}
}

func podWithRestarts(name, app string, counts ...int32) *corev1.Pod {
	p := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "prod", Labels: map[string]string{"app": app}}}
	for _, c := range counts {
		p.Status.ContainerStatuses = append(p.Status.ContainerStatuses, corev1.ContainerStatus{RestartCount: c})
	}
	return p
}

func TestDeploymentNames(t *testing.T) {
	cs := fake.NewSimpleClientset(
		&appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "a", Namespace: "x"}},
		&appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "b", Namespace: "y"}},
	)
	all, err := deploymentNames(context.Background(), cs, "")
	if err != nil || len(all) != 2 {
		t.Fatalf("got %v %v", all, err)
	}
	one, err := deploymentNames(context.Background(), cs, "y")
	if err != nil || len(one) != 1 || one[0].Name != "b" {
		t.Fatalf("got %v %v", one, err)
	}
	none, _ := deploymentNames(context.Background(), cs, "empty")
	if none == nil {
		t.Fatal("expected empty slice, not nil")
	}
}
