package kube

import (
	"testing"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
)

// The Overview's running-jobs list opens the pod a Job launched, so a Job
// resolves to the pods its own selector matches and to no other run's.
func TestPodsForOwnerJob(t *testing.T) {
	cs := fake.NewClientset()
	f := informers.NewSharedInformerFactory(cs, 0)
	w := &contextWatcher{cs: cs, factory: f, started: map[string]bool{"Job": true, "Pod": true}}

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "migrate", Namespace: "batch"},
		Spec: batchv1.JobSpec{Selector: &metav1.LabelSelector{
			MatchLabels: map[string]string{"batch.kubernetes.io/controller-uid": "uid-1"},
		}},
	}
	if err := f.Batch().V1().Jobs().Informer().GetStore().Add(job); err != nil {
		t.Fatal(err)
	}
	pod := func(name, uid string) *corev1.Pod {
		return &corev1.Pod{ObjectMeta: metav1.ObjectMeta{
			Name: name, Namespace: "batch",
			Labels: map[string]string{"batch.kubernetes.io/controller-uid": uid},
		}}
	}
	for _, p := range []*corev1.Pod{pod("migrate-abc", "uid-1"), pod("other-run", "uid-2")} {
		if err := f.Core().V1().Pods().Informer().GetStore().Add(p); err != nil {
			t.Fatal(err)
		}
	}

	got, err := w.PodsForOwner("Job", "batch", "migrate")
	if err != nil {
		t.Fatalf("PodsForOwner(Job): %v", err)
	}
	if len(got) != 1 || got[0].Name != "migrate-abc" {
		t.Fatalf("got %+v, want only migrate-abc", got)
	}
}
