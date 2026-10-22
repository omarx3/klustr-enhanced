import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { duplicateManifest, duplicateName } from './duplicate'

const deployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  annotations:
    deployment.kubernetes.io/revision: "4"
    kubectl.kubernetes.io/last-applied-configuration: |
      {"kind":"Deployment"}
    team: payments
  labels:
    app: backend
  name: backend
  namespace: prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - image: ghcr.io/acme/backend:1.2.3
        name: backend
        ports:
        - containerPort: 8080
`

describe('duplicateManifest', () => {
  it('renames the object to copy-of-<name> and keeps the rest of the manifest', () => {
    const { manifest, kind, name } = duplicateManifest(deployment)
    expect(kind).toBe('Deployment')
    expect(name).toBe('copy-of-backend')
    const obj = parse(manifest)
    expect(obj.metadata.name).toBe('copy-of-backend')
    expect(obj.metadata.namespace).toBe('prod')
    expect(obj.metadata.labels).toEqual({ app: 'backend' })
    expect(obj.spec.replicas).toBe(3)
    expect(obj.spec.selector).toEqual({ matchLabels: { app: 'backend' } })
    expect(obj.spec.template.spec.containers[0].image).toBe('ghcr.io/acme/backend:1.2.3')
  })

  it('drops annotations that belong to the original but keeps user annotations', () => {
    const obj = parse(duplicateManifest(deployment).manifest)
    expect(obj.metadata.annotations).toEqual({ team: 'payments' })
  })

  it('removes the annotations map when nothing is left in it', () => {
    const src = `apiVersion: v1
kind: ConfigMap
metadata:
  annotations:
    kubectl.kubernetes.io/last-applied-configuration: "{}"
  name: settings
  namespace: default
data:
  a: "1"
`
    const obj = parse(duplicateManifest(src).manifest)
    expect(obj.metadata).toEqual({ name: 'copy-of-settings', namespace: 'default' })
    expect(obj.data).toEqual({ a: '1' })
  })

  it('releases the IPs and node ports a Service was allocated', () => {
    const src = `apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: default
spec:
  type: NodePort
  clusterIP: 10.96.12.7
  clusterIPs:
  - 10.96.12.7
  ports:
  - port: 80
    targetPort: 8080
    nodePort: 31234
  selector:
    app: api
`
    const obj = parse(duplicateManifest(src).manifest)
    expect(obj.spec.clusterIP).toBeUndefined()
    expect(obj.spec.clusterIPs).toBeUndefined()
    expect(obj.spec.ports).toEqual([{ port: 80, targetPort: 8080 }])
    expect(obj.spec.selector).toEqual({ app: 'api' })
  })

  it('keeps a headless Service headless', () => {
    const src = `apiVersion: v1
kind: Service
metadata:
  name: db
spec:
  clusterIP: None
  clusterIPs:
  - None
  ports:
  - port: 5432
`
    expect(parse(duplicateManifest(src).manifest).spec.clusterIP).toBe('None')
  })

  it('unbinds a PersistentVolumeClaim from the original volume', () => {
    const src = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  annotations:
    pv.kubernetes.io/bind-completed: "yes"
  name: data
  namespace: default
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  volumeName: pvc-123
`
    const obj = parse(duplicateManifest(src).manifest)
    expect(obj.spec.volumeName).toBeUndefined()
    expect(obj.metadata.annotations).toBeUndefined()
    expect(obj.spec.resources.requests.storage).toBe('1Gi')
  })

  it('lets the apiserver generate a new selector for a Job', () => {
    const src = `apiVersion: batch/v1
kind: Job
metadata:
  labels:
    batch.kubernetes.io/controller-uid: 1111
    batch.kubernetes.io/job-name: migrate
    controller-uid: 1111
    job-name: migrate
    team: data
  name: migrate
  namespace: default
spec:
  selector:
    matchLabels:
      batch.kubernetes.io/controller-uid: 1111
  template:
    metadata:
      labels:
        batch.kubernetes.io/controller-uid: 1111
        batch.kubernetes.io/job-name: migrate
        controller-uid: 1111
        job-name: migrate
    spec:
      restartPolicy: Never
      containers:
      - name: m
        image: busybox
`
    const obj = parse(duplicateManifest(src).manifest)
    expect(obj.spec.selector).toBeUndefined()
    expect(obj.metadata.labels).toEqual({ team: 'data' })
    expect(obj.spec.template.metadata).toBeUndefined()
  })

  it('takes a Pod off its node and away from its ReplicaSet', () => {
    const src = `apiVersion: v1
kind: Pod
metadata:
  labels:
    app: web
    pod-template-hash: 7c9d
  name: web-7c9d-abcde
  namespace: default
spec:
  nodeName: worker-1
  containers:
  - name: web
    image: nginx
`
    const obj = parse(duplicateManifest(src).manifest)
    expect(obj.metadata.name).toBe('copy-of-web-7c9d-abcde')
    expect(obj.metadata.labels).toEqual({ app: 'web' })
    expect(obj.spec.nodeName).toBeUndefined()
  })

  it('leaves custom resources alone apart from the name', () => {
    const src = `apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: tls
  namespace: default
spec:
  secretName: tls
  dnsNames:
  - example.com
`
    const obj = parse(duplicateManifest(src).manifest)
    expect(obj).toEqual({
      apiVersion: 'cert-manager.io/v1',
      kind: 'Certificate',
      metadata: { name: 'copy-of-tls', namespace: 'default' },
      spec: { secretName: 'tls', dnsNames: ['example.com'] },
    })
  })

  it('indents list items under their key like the create editor does', () => {
    expect(duplicateManifest(deployment).manifest).toContain('      containers:\n        - image:')
  })

  it('rejects YAML without a name', () => {
    expect(() => duplicateManifest('apiVersion: v1\nkind: ConfigMap\n')).toThrow()
  })

  it('prefixes the name', () => {
    expect(duplicateName('backend')).toBe('copy-of-backend')
  })
})
