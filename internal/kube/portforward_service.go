package kube

import (
	"context"
	"fmt"
	"sort"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
)

// serviceTarget is the pod and container port a Service port-forward tunnels
// to. The API has no portforward subresource on Services, so, like kubectl
// port-forward svc/x, the forward is pinned to one ready backing pod.
type serviceTarget struct {
	pod        string
	remotePort uint16
}

// resolveServiceTarget picks the backing pod and container port for svcPort
// (the Service's own port number). A named targetPort is resolved against
// the chosen pod's container ports, since each pod may number it differently.
func resolveServiceTarget(svc *corev1.Service, pods []corev1.Pod, svcPort int32) (serviceTarget, error) {
	if len(svc.Spec.Selector) == 0 {
		return serviceTarget{}, fmt.Errorf("service %s has no selector, so it has no pods to forward to", svc.Name)
	}
	var port *corev1.ServicePort
	for i := range svc.Spec.Ports {
		if svc.Spec.Ports[i].Port == svcPort {
			port = &svc.Spec.Ports[i]
			break
		}
	}
	if port == nil {
		return serviceTarget{}, fmt.Errorf("service %s has no port %d", svc.Name, svcPort)
	}
	if port.Protocol != "" && port.Protocol != corev1.ProtocolTCP {
		return serviceTarget{}, fmt.Errorf("port %d is %s; port-forward supports TCP only", svcPort, port.Protocol)
	}

	selector := labels.SelectorFromSet(svc.Spec.Selector)
	candidates := make([]corev1.Pod, 0, len(pods))
	for _, p := range pods {
		if p.Namespace == svc.Namespace && p.DeletionTimestamp == nil &&
			p.Status.Phase == corev1.PodRunning && selector.Matches(labels.Set(p.Labels)) {
			candidates = append(candidates, p)
		}
	}
	// Ready pods first, then by name, so repeated starts pick the same pod.
	sort.SliceStable(candidates, func(i, j int) bool {
		ri, rj := podReady(&candidates[i]), podReady(&candidates[j])
		if ri != rj {
			return ri
		}
		return candidates[i].Name < candidates[j].Name
	})

	var lastErr error
	for i := range candidates {
		remote, err := containerPortFor(&candidates[i], port.TargetPort, port.Port)
		if err != nil {
			lastErr = err
			continue
		}
		return serviceTarget{pod: candidates[i].Name, remotePort: remote}, nil
	}
	if lastErr != nil {
		return serviceTarget{}, lastErr
	}
	return serviceTarget{}, fmt.Errorf("service %s has no running pods", svc.Name)
}

func containerPortFor(p *corev1.Pod, target intstr.IntOrString, servicePort int32) (uint16, error) {
	switch {
	case target.Type == intstr.String && target.StrVal != "":
		for _, c := range p.Spec.Containers {
			for _, cp := range c.Ports {
				if cp.Name == target.StrVal {
					return uint16(cp.ContainerPort), nil
				}
			}
		}
		return 0, fmt.Errorf("pod %s has no container port named %q", p.Name, target.StrVal)
	case target.Type == intstr.Int && target.IntVal > 0:
		return uint16(target.IntVal), nil
	default:
		// An unset targetPort defaults to the Service port.
		return uint16(servicePort), nil
	}
}

func (m *ClientManager) StartServicePortForward(contextName, namespace, serviceName string, servicePort int32, localPort uint16) (PortForwardInfo, error) {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return PortForwardInfo{}, err
	}
	target, err := lookupServiceTarget(context.Background(), cs, namespace, serviceName, servicePort)
	if err != nil {
		return PortForwardInfo{}, err
	}
	base := PortForwardInfo{
		Context:     contextName,
		Namespace:   namespace,
		PodName:     target.pod,
		ServiceName: serviceName,
		ServicePort: servicePort,
	}
	return m.pf.startWith(base, func(ctx context.Context, readyCh chan struct{}) (portForwarder, error) {
		cfg, err := m.restConfig(contextName)
		if err != nil {
			return nil, err
		}
		return newPortForwarder(ctx, cs, cfg, namespace, target.pod, localPort, target.remotePort, readyCh)
	})
}

func lookupServiceTarget(ctx context.Context, cs kubernetes.Interface, namespace, name string, servicePort int32) (serviceTarget, error) {
	ctx, cancel := context.WithTimeout(ctx, pfReadyTimeout)
	defer cancel()
	svc, err := cs.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return serviceTarget{}, err
	}
	if len(svc.Spec.Selector) == 0 {
		return resolveServiceTarget(svc, nil, servicePort)
	}
	pods, err := cs.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labels.SelectorFromSet(svc.Spec.Selector).String(),
	})
	if err != nil {
		return serviceTarget{}, err
	}
	return resolveServiceTarget(svc, pods.Items, servicePort)
}

// StopServicePortForwards stops every forward started for the Service.
func (m *ClientManager) StopServicePortForwards(contextName, namespace, serviceName string) {
	m.pf.stopMatching(func(i PortForwardInfo) bool {
		return i.ServiceName != "" && i.Context == contextName && i.Namespace == namespace && i.ServiceName == serviceName
	})
}
