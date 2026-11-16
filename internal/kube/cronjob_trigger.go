package kube

import (
	"context"
	"strings"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	utilrand "k8s.io/apimachinery/pkg/util/rand"
)

// TriggerCronJob runs a CronJob once now by creating a Job from its
// jobTemplate, the same object `kubectl create job --from=cronjob/<name>`
// builds. It returns the new Job's name.
func (m *ClientManager) TriggerCronJob(ctx context.Context, contextName, namespace, name string) (string, error) {
	if err := m.assertWritable(contextName); err != nil {
		return "", err
	}
	cs, err := m.Clientset(contextName)
	if err != nil {
		return "", err
	}
	cj, err := cs.BatchV1().CronJobs(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	job, err := cs.BatchV1().Jobs(namespace).Create(ctx, manualJobFromCronJob(cj, utilrand.String(5)),
		metav1.CreateOptions{FieldManager: "klustr"})
	if err != nil {
		return "", err
	}
	return job.Name, nil
}

func manualJobFromCronJob(cj *batchv1.CronJob, suffix string) *batchv1.Job {
	// The Job controller copies the Job name into the pods' job-name label,
	// so it must fit a 63-character label value.
	tail := "-manual-" + suffix
	base := cj.Name
	if len(base)+len(tail) > 63 {
		base = strings.TrimRight(base[:63-len(tail)], "-.")
	}
	annotations := map[string]string{"cronjob.kubernetes.io/instantiate": "manual"}
	for k, v := range cj.Spec.JobTemplate.Annotations {
		annotations[k] = v
	}
	labels := map[string]string{}
	for k, v := range cj.Spec.JobTemplate.Labels {
		labels[k] = v
	}
	controller := true
	return &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:        base + tail,
			Namespace:   cj.Namespace,
			Labels:      labels,
			Annotations: annotations,
			OwnerReferences: []metav1.OwnerReference{{
				APIVersion: "batch/v1",
				Kind:       "CronJob",
				Name:       cj.Name,
				UID:        cj.UID,
				Controller: &controller,
			}},
		},
		Spec: *cj.Spec.JobTemplate.Spec.DeepCopy(),
	}
}
