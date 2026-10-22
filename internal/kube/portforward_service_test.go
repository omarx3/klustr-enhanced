package kube

import (
	"strings"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

func svcFixture(ports ...corev1.ServicePort) *corev1.Service {
	return &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "web", Namespace: "apps"},
		Spec:       corev1.ServiceSpec{Selector: map[string]string{"app": "web"}, Ports: ports},
	}
}

func podFixture(name string, ready bool, containerPorts ...corev1.ContainerPort) corev1.Pod {
	status := corev1.ConditionFalse
	if ready {
		status = corev1.ConditionTrue
	}
	return corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "apps", Labels: map[string]string{"app": "web"}},
		Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "c", Ports: containerPorts}}},
		Status: corev1.PodStatus{
			Phase:      corev1.PodRunning,
			Conditions: []corev1.PodCondition{{Type: corev1.PodReady, Status: status}},
		},
	}
}

func TestResolveServiceTargetPrefersReadyPodAndNumericTarget(t *testing.T) {
	svc := svcFixture(corev1.ServicePort{Port: 80, TargetPort: intstr.FromInt32(8080)})
	pods := []corev1.Pod{podFixture("a-not-ready", false), podFixture("b-ready", true), podFixture("c-ready", true)}
	got, err := resolveServiceTarget(svc, pods, 80)
	if err != nil {
		t.Fatal(err)
	}
	if got.pod != "b-ready" || got.remotePort != 8080 {
		t.Fatalf("got %+v, want b-ready:8080", got)
	}
}

func TestResolveServiceTargetNamedTargetPort(t *testing.T) {
	svc := svcFixture(corev1.ServicePort{Port: 443, TargetPort: intstr.FromString("https")})
	pods := []corev1.Pod{podFixture("p", true, corev1.ContainerPort{Name: "https", ContainerPort: 8443})}
	got, err := resolveServiceTarget(svc, pods, 443)
	if err != nil {
		t.Fatal(err)
	}
	if got.remotePort != 8443 {
		t.Fatalf("remotePort = %d, want 8443", got.remotePort)
	}
}

func TestResolveServiceTargetDefaultsTargetToServicePort(t *testing.T) {
	svc := svcFixture(corev1.ServicePort{Port: 9090})
	got, err := resolveServiceTarget(svc, []corev1.Pod{podFixture("p", true)}, 9090)
	if err != nil || got.remotePort != 9090 {
		t.Fatalf("got %+v, %v; want port 9090", got, err)
	}
}

func TestResolveServiceTargetErrors(t *testing.T) {
	tcp := corev1.ServicePort{Port: 80, TargetPort: intstr.FromInt32(80)}
	cases := []struct {
		name string
		svc  *corev1.Service
		pods []corev1.Pod
		port int32
		want string
	}{
		{"no selector", &corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: "ext"}, Spec: corev1.ServiceSpec{Ports: []corev1.ServicePort{tcp}}}, nil, 80, "no selector"},
		{"unknown port", svcFixture(tcp), []corev1.Pod{podFixture("p", true)}, 81, "no port 81"},
		{"udp", svcFixture(corev1.ServicePort{Port: 53, Protocol: corev1.ProtocolUDP}), []corev1.Pod{podFixture("p", true)}, 53, "TCP only"},
		{"no pods", svcFixture(tcp), nil, 80, "no running pods"},
		{"named port missing", svcFixture(corev1.ServicePort{Port: 80, TargetPort: intstr.FromString("http")}), []corev1.Pod{podFixture("p", true)}, 80, `named "http"`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := resolveServiceTarget(c.svc, c.pods, c.port)
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("err = %v, want it to contain %q", err, c.want)
			}
		})
	}
}

func TestResolveServiceTargetSkipsPodsOutsideSelectorOrNotRunning(t *testing.T) {
	svc := svcFixture(corev1.ServicePort{Port: 80})
	other := podFixture("a-other-app", true)
	other.Labels = map[string]string{"app": "api"}
	pending := podFixture("b-pending", true)
	pending.Status.Phase = corev1.PodPending
	got, err := resolveServiceTarget(svc, []corev1.Pod{other, pending, podFixture("c-ok", false)}, 80)
	if err != nil || got.pod != "c-ok" {
		t.Fatalf("got %+v, %v; want c-ok", got, err)
	}
}

func TestStopMatchingStopsOnlyThatService(t *testing.T) {
	mgr := newPFManager()
	webDone := mgr.addSessionForTest("pf-1", "ctx-a")
	apiDone := mgr.addSessionForTest("pf-2", "ctx-a")
	mgr.mu.Lock()
	mgr.sessions["pf-1"].info.ServiceName = "web"
	mgr.sessions["pf-1"].info.Namespace = "apps"
	mgr.sessions["pf-2"].info.ServiceName = "api"
	mgr.sessions["pf-2"].info.Namespace = "apps"
	mgr.mu.Unlock()

	notified := 0
	mgr.setOnChange(func() { notified++ })
	mgr.stopMatching(func(i PortForwardInfo) bool {
		return i.Context == "ctx-a" && i.Namespace == "apps" && i.ServiceName == "web"
	})
	if !isClosed(webDone) || isClosed(apiDone) {
		t.Fatal("expected only the web forward to stop")
	}
	if notified != 1 {
		t.Fatalf("notified %d times, want 1", notified)
	}
}
