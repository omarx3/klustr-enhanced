package kube

import (
	"strings"
	"testing"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestManualJobFromCronJob(t *testing.T) {
	cj := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "backup", Namespace: "ops", UID: "uid-1"},
		Spec: batchv1.CronJobSpec{JobTemplate: batchv1.JobTemplateSpec{
			ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "backup"}},
		}},
	}
	job := manualJobFromCronJob(cj, "abcde")
	if job.Name != "backup-manual-abcde" || job.Namespace != "ops" {
		t.Fatalf("got %s/%s", job.Namespace, job.Name)
	}
	if job.Labels["app"] != "backup" || job.Annotations["cronjob.kubernetes.io/instantiate"] != "manual" {
		t.Fatalf("labels %v annotations %v", job.Labels, job.Annotations)
	}
	ref := job.OwnerReferences[0]
	if ref.Kind != "CronJob" || ref.UID != "uid-1" || !*ref.Controller {
		t.Fatalf("owner %+v", ref)
	}

	cj.Name = strings.Repeat("a", 60)
	if n := manualJobFromCronJob(cj, "abcde").Name; len(n) > 63 || !strings.HasSuffix(n, "-manual-abcde") {
		t.Fatalf("long name not truncated: %q (%d)", n, len(n))
	}
}
