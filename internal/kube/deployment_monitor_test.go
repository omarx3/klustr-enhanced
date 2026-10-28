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
		ObjectMeta: metav1.ObjectMeta{Name: "web", Namespace: "prod"},
		Spec: appsv1.DeploymentSpec{
			Replicas: &three,
			Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{Containers: []corev1.Container{
				{Name: "app", Image: "nginx:1.25"},
				{Name: "sidecar", Image: "envoy:1.30"},
			}}},
		},
		Status: appsv1.DeploymentStatus{ReadyReplicas: 2},
	}, &appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "bare", Namespace: "prod"}})

	got, err := deploymentStatus(context.Background(), cs, "prod", "web")
	if err != nil {
		t.Fatal(err)
	}
	if got.Replicas != 3 || got.Ready != 2 || len(got.Images) != 2 || got.Images[1] != "envoy:1.30" {
		t.Fatalf("unexpected status %+v", got)
	}

	bare, err := deploymentStatus(context.Background(), cs, "prod", "bare")
	if err != nil {
		t.Fatal(err)
	}
	if bare.Replicas != 1 || bare.Images == nil {
		t.Fatalf("defaults not applied: %+v", bare)
	}

	if _, err := deploymentStatus(context.Background(), cs, "prod", "missing"); err == nil {
		t.Fatal("expected not found")
	}
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
