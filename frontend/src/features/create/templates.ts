// Starter manifests for the "+" (create) action, one per built-in kind. They
// follow the examples in the Kubernetes docs, are complete enough for the API
// server to accept with no edits, and use 2-space indentation with "- " list
// items indented under their key, matching what Format produces. Namespaced
// templates carry `namespace: __NAMESPACE__`, filled in from the namespace
// selection when the editor opens.

export const NAMESPACE_PLACEHOLDER = '__NAMESPACE__'

const T: Record<string, string> = {
  Service: `apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: __NAMESPACE__
spec:
  selector:
    app: MyApp
  ports:
    - protocol: TCP
      port: 80
      targetPort: 9376
`,
  Pod: `apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  namespace: __NAMESPACE__
  labels:
    app: my-app
spec:
  containers:
    - name: nginx
      image: nginx:1.27
      ports:
        - containerPort: 80
`,
  Deployment: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
  namespace: __NAMESPACE__
  labels:
    app: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80
`,
  StatefulSet: `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: my-statefulset
  namespace: __NAMESPACE__
spec:
  serviceName: my-statefulset
  replicas: 1
  selector:
    matchLabels:
      app: my-statefulset
  template:
    metadata:
      labels:
        app: my-statefulset
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80
              name: web
`,
  DaemonSet: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: my-daemonset
  namespace: __NAMESPACE__
spec:
  selector:
    matchLabels:
      app: my-daemonset
  template:
    metadata:
      labels:
        app: my-daemonset
    spec:
      containers:
        - name: agent
          image: busybox:1.36
          command: ["sh", "-c", "sleep infinity"]
`,
  ReplicaSet: `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: my-replicaset
  namespace: __NAMESPACE__
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-replicaset
  template:
    metadata:
      labels:
        app: my-replicaset
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
`,
  ReplicationController: `apiVersion: v1
kind: ReplicationController
metadata:
  name: my-rc
  namespace: __NAMESPACE__
spec:
  replicas: 1
  selector:
    app: my-rc
  template:
    metadata:
      labels:
        app: my-rc
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
`,
  Job: `apiVersion: batch/v1
kind: Job
metadata:
  name: my-job
  namespace: __NAMESPACE__
spec:
  backoffLimit: 4
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: hello
          image: busybox:1.36
          command: ["sh", "-c", "echo Hello from Kubernetes"]
`,
  CronJob: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: my-cronjob
  namespace: __NAMESPACE__
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: hello
              image: busybox:1.36
              command: ["sh", "-c", "date; echo Hello"]
`,
  ConfigMap: `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
  namespace: __NAMESPACE__
data:
  key: value
`,
  Secret: `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  namespace: __NAMESPACE__
type: Opaque
stringData:
  username: admin
  password: change-me
`,
  Ingress: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  namespace: __NAMESPACE__
spec:
  rules:
    - host: example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-service
                port:
                  number: 80
`,
  IngressClass: `apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: my-ingress-class
spec:
  controller: example.com/ingress-controller
`,
  NetworkPolicy: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: my-network-policy
  namespace: __NAMESPACE__
spec:
  podSelector:
    matchLabels:
      app: my-app
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              role: frontend
      ports:
        - protocol: TCP
          port: 80
`,
  Endpoints: `apiVersion: v1
kind: Endpoints
metadata:
  name: my-endpoints
  namespace: __NAMESPACE__
subsets:
  - addresses:
      - ip: 192.0.2.42
    ports:
      - port: 9376
`,
  EndpointSlice: `apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: my-endpointslice
  namespace: __NAMESPACE__
  labels:
    kubernetes.io/service-name: my-service
addressType: IPv4
ports:
  - name: http
    protocol: TCP
    port: 80
endpoints:
  - addresses:
      - 10.1.2.3
`,
  PersistentVolumeClaim: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
  namespace: __NAMESPACE__
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
`,
  PersistentVolume: `apiVersion: v1
kind: PersistentVolume
metadata:
  name: my-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /mnt/data
`,
  StorageClass: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: my-storage-class
provisioner: kubernetes.io/no-provisioner
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
`,
  CSIDriver: `apiVersion: storage.k8s.io/v1
kind: CSIDriver
metadata:
  name: my-driver.example.com
spec:
  attachRequired: true
  podInfoOnMount: false
`,
  VolumeAttachment: `apiVersion: storage.k8s.io/v1
kind: VolumeAttachment
metadata:
  name: my-volume-attachment
spec:
  attacher: my-driver.example.com
  nodeName: my-node
  source:
    persistentVolumeName: my-pv
`,
  HorizontalPodAutoscaler: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-hpa
  namespace: __NAMESPACE__
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-deployment
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 80
`,
  PodDisruptionBudget: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: my-pdb
  namespace: __NAMESPACE__
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: my-app
`,
  ResourceQuota: `apiVersion: v1
kind: ResourceQuota
metadata:
  name: my-quota
  namespace: __NAMESPACE__
spec:
  hard:
    pods: "10"
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
`,
  LimitRange: `apiVersion: v1
kind: LimitRange
metadata:
  name: my-limit-range
  namespace: __NAMESPACE__
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 512Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
`,
  PriorityClass: `apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: my-priority
value: 1000
globalDefault: false
description: Priority class for important workloads.
`,
  RuntimeClass: `apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: my-runtime-class
handler: runc
`,
  Lease: `apiVersion: coordination.k8s.io/v1
kind: Lease
metadata:
  name: my-lease
  namespace: __NAMESPACE__
spec:
  holderIdentity: my-holder
  leaseDurationSeconds: 15
`,
  Namespace: `apiVersion: v1
kind: Namespace
metadata:
  name: my-namespace
`,
  Node: `apiVersion: v1
kind: Node
metadata:
  name: my-node
  labels:
    kubernetes.io/hostname: my-node
`,
  ServiceAccount: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-service-account
  namespace: __NAMESPACE__
`,
  Role: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: __NAMESPACE__
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "watch", "list"]
`,
  RoleBinding: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: __NAMESPACE__
subjects:
  - kind: ServiceAccount
    name: my-service-account
    namespace: __NAMESPACE__
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
`,
  ClusterRole: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: my-cluster-role
rules:
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "watch", "list"]
`,
  ClusterRoleBinding: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: my-cluster-role-binding
subjects:
  - kind: Group
    name: my-group
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: my-cluster-role
  apiGroup: rbac.authorization.k8s.io
`,
  CertificateSigningRequest: `apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: my-csr
spec:
  # Base64 PKCS#10 request. This sample is for CN=my-user (its key was
  # discarded); replace it with your own: openssl req -new ... | base64 -w0
  request: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURSBSRVFVRVNULS0tLS0KTUlIaE1JR0hBZ0VBTUNVeEVEQU9CZ05WQkFNTUIyMTVMWFZ6WlhJeEVUQVBCZ05WQkFvTUNHMTVMV2R5YjNWdwpNRmt3RXdZSEtvWkl6ajBDQVFZSUtvWkl6ajBEQVFjRFFnQUVodjlWRVoxVE0rNURtUGovOFZxUjN6aklndko5CjRjVzQ0bG1LdEhWUVM3VlFOTUx6RVNBakwwaUxBdWp5ZEU3ZXBaMFQxY0pFRCtJdWpVbTd0TDB2K3FBQU1Bb0cKQ0NxR1NNNDlCQU1DQTBrQU1FWUNJUURjNUpoRGV3WmE5OWNtaTk2amdIZitCai9veFIwMldSMWxPcHpIdmxmbwo5Z0loQVAwK3NJbDNxS3NxVzYzR0dhTFJIc016WGJtamV3Q3oxZ002d3FYS2V2UWIKLS0tLS1FTkQgQ0VSVElGSUNBVEUgUkVRVUVTVC0tLS0tCg==
  signerName: kubernetes.io/kube-apiserver-client
  expirationSeconds: 86400
  usages:
    - client auth
`,
  MutatingWebhookConfiguration: `apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: my-mutating-webhook
webhooks:
  - name: my-webhook.example.com
    admissionReviewVersions: ["v1"]
    sideEffects: None
    failurePolicy: Ignore
    clientConfig:
      service:
        name: my-webhook
        namespace: default
        path: /mutate
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["pods"]
`,
  ValidatingWebhookConfiguration: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: my-validating-webhook
webhooks:
  - name: my-webhook.example.com
    admissionReviewVersions: ["v1"]
    sideEffects: None
    failurePolicy: Ignore
    clientConfig:
      service:
        name: my-webhook
        namespace: default
        path: /validate
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["pods"]
`,
  ValidatingAdmissionPolicy: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: max-replicas
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments"]
  validations:
    - expression: "object.spec.replicas <= 5"
`,
  ValidatingAdmissionPolicyBinding: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: max-replicas-binding
spec:
  policyName: max-replicas
  validationActions: ["Deny"]
`,
  MutatingAdmissionPolicy: `apiVersion: admissionregistration.k8s.io/v1
kind: MutatingAdmissionPolicy
metadata:
  name: add-label
spec:
  failurePolicy: Fail
  reinvocationPolicy: Never
  matchConstraints:
    resourceRules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["configmaps"]
  mutations:
    - patchType: ApplyConfiguration
      applyConfiguration:
        expression: >
          Object{metadata: Object.metadata{labels: {"managed": "true"}}}
`,
  MutatingAdmissionPolicyBinding: `apiVersion: admissionregistration.k8s.io/v1
kind: MutatingAdmissionPolicyBinding
metadata:
  name: add-label-binding
spec:
  policyName: add-label
`,
  FlowSchema: `apiVersion: flowcontrol.apiserver.k8s.io/v1
kind: FlowSchema
metadata:
  name: my-flow-schema
spec:
  priorityLevelConfiguration:
    name: workload-low
  matchingPrecedence: 1000
  distinguisherMethod:
    type: ByUser
  rules:
    - subjects:
        - kind: Group
          group:
            name: my-group
      resourceRules:
        - verbs: ["*"]
          apiGroups: ["*"]
          resources: ["*"]
          namespaces: ["*"]
`,
  PriorityLevelConfiguration: `apiVersion: flowcontrol.apiserver.k8s.io/v1
kind: PriorityLevelConfiguration
metadata:
  name: my-priority-level
spec:
  type: Limited
  limited:
    nominalConcurrencyShares: 10
    limitResponse:
      type: Reject
`,
  APIService: `apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata:
  name: v1beta1.example.com
spec:
  group: example.com
  version: v1beta1
  groupPriorityMinimum: 1000
  versionPriority: 15
  service:
    name: my-api
    namespace: default
`,
  DeviceClass: `apiVersion: resource.k8s.io/v1
kind: DeviceClass
metadata:
  name: my-device-class
spec:
  selectors:
    - cel:
        expression: device.driver == "gpu.example.com"
`,
  ResourceClaim: `apiVersion: resource.k8s.io/v1
kind: ResourceClaim
metadata:
  name: my-claim
  namespace: __NAMESPACE__
spec:
  devices:
    requests:
      - name: gpu
        exactly:
          deviceClassName: my-device-class
`,
  ResourceClaimTemplate: `apiVersion: resource.k8s.io/v1
kind: ResourceClaimTemplate
metadata:
  name: my-claim-template
  namespace: __NAMESPACE__
spec:
  spec:
    devices:
      requests:
        - name: gpu
          exactly:
            deviceClassName: my-device-class
`,
  ResourceSlice: `apiVersion: resource.k8s.io/v1
kind: ResourceSlice
metadata:
  name: my-resource-slice
spec:
  driver: gpu.example.com
  nodeName: my-node
  pool:
    name: my-node
    generation: 1
    resourceSliceCount: 1
  devices:
    - name: gpu-0
`,
  ServiceCIDR: `apiVersion: networking.k8s.io/v1
kind: ServiceCIDR
metadata:
  name: my-service-cidr
spec:
  cidrs:
    - 10.96.100.0/24
`,
  IPAddress: `apiVersion: networking.k8s.io/v1
kind: IPAddress
metadata:
  name: 10.96.100.10
spec:
  parentRef:
    group: ""
    resource: services
    namespace: default
    name: my-service
`,
  Gateway: `apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: my-gateway
  namespace: __NAMESPACE__
spec:
  gatewayClassName: my-gateway-class
  listeners:
    - name: http
      protocol: HTTP
      port: 80
`,
  GatewayClass: `apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: my-gateway-class
spec:
  controllerName: example.com/gateway-controller
`,
  HTTPRoute: `apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: my-route
  namespace: __NAMESPACE__
spec:
  parentRefs:
    - name: my-gateway
  hostnames:
    - example.com
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: my-service
          port: 80
`,
  GRPCRoute: `apiVersion: gateway.networking.k8s.io/v1
kind: GRPCRoute
metadata:
  name: my-grpc-route
  namespace: __NAMESPACE__
spec:
  parentRefs:
    - name: my-gateway
  rules:
    - backendRefs:
        - name: my-grpc-service
          port: 50051
`,
  TLSRoute: `apiVersion: gateway.networking.k8s.io/v1alpha2
kind: TLSRoute
metadata:
  name: my-tls-route
  namespace: __NAMESPACE__
spec:
  parentRefs:
    - name: my-gateway
  hostnames:
    - example.com
  rules:
    - backendRefs:
        - name: my-service
          port: 443
`,
  TCPRoute: `apiVersion: gateway.networking.k8s.io/v1alpha2
kind: TCPRoute
metadata:
  name: my-tcp-route
  namespace: __NAMESPACE__
spec:
  parentRefs:
    - name: my-gateway
  rules:
    - backendRefs:
        - name: my-service
          port: 9000
`,
  UDPRoute: `apiVersion: gateway.networking.k8s.io/v1alpha2
kind: UDPRoute
metadata:
  name: my-udp-route
  namespace: __NAMESPACE__
spec:
  parentRefs:
    - name: my-gateway
  rules:
    - backendRefs:
        - name: my-service
          port: 53
`,
  ListenerSet: `apiVersion: gateway.networking.k8s.io/v1
kind: ListenerSet
metadata:
  name: my-listener-set
  namespace: __NAMESPACE__
spec:
  parentRef:
    name: my-gateway
  listeners:
    - name: http-extra
      protocol: HTTP
      port: 8080
`,
  BackendTLSPolicy: `apiVersion: gateway.networking.k8s.io/v1
kind: BackendTLSPolicy
metadata:
  name: my-backend-tls
  namespace: __NAMESPACE__
spec:
  targetRefs:
    - group: ""
      kind: Service
      name: my-service
  validation:
    hostname: my-service.example.com
    wellKnownCACertificates: System
`,
  ReferenceGrant: `apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: my-reference-grant
  namespace: __NAMESPACE__
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: other-namespace
  to:
    - group: ""
      kind: Service
`,
}

// Kinds the API server manages itself; creating them by hand is not useful.
// The + button is not offered for them.
const NOT_CREATABLE = new Set(['CSINode', 'HelmRelease'])

export function canCreateKind(kind: string): boolean {
  return !NOT_CREATABLE.has(kind) && (kind in T || kind.startsWith('cr:'))
}

export type CustomResourceTemplateInput = {
  group: string
  version: string
  kind: string
  namespaced: boolean
}

function lowerKebab(kind: string): string {
  return kind.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

export function customResourceTemplate({ group, version, kind, namespaced }: CustomResourceTemplateInput): string {
  const apiVersion = group ? `${group}/${version}` : version
  return [
    `apiVersion: ${apiVersion}`,
    `kind: ${kind}`,
    'metadata:',
    `  name: my-${lowerKebab(kind)}`,
    ...(namespaced ? [`  namespace: ${NAMESPACE_PLACEHOLDER}`] : []),
    'spec: {}',
    '',
  ].join('\n')
}

// The editor's starting text. The namespace is the single selected namespace,
// or "default" when the selection is empty or spans several.
export function resourceTemplate(kind: string, namespace: string, custom?: CustomResourceTemplateInput): string | null {
  const raw = custom ? customResourceTemplate(custom) : T[kind]
  if (!raw) return null
  return raw.replaceAll(NAMESPACE_PLACEHOLDER, namespace || 'default')
}

export const BUILT_IN_TEMPLATE_KINDS: readonly string[] = Object.keys(T)
