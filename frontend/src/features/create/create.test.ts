import { describe, expect, it } from 'vitest'
import {
  BUILT_IN_TEMPLATE_KINDS,
  canCreateKind,
  customResourceTemplate,
  resourceTemplate,
} from './templates'
import { hasErrors, validateManifest } from './validateManifest'

const CLUSTER_SCOPED = new Set([
  'Namespace', 'Node', 'PersistentVolume', 'StorageClass', 'IngressClass', 'PriorityClass', 'RuntimeClass',
  'ClusterRole', 'ClusterRoleBinding', 'MutatingWebhookConfiguration', 'ValidatingWebhookConfiguration',
  'ValidatingAdmissionPolicy', 'ValidatingAdmissionPolicyBinding', 'MutatingAdmissionPolicy',
  'MutatingAdmissionPolicyBinding', 'APIService', 'GatewayClass', 'CertificateSigningRequest', 'CSIDriver',
  'VolumeAttachment', 'FlowSchema', 'PriorityLevelConfiguration', 'DeviceClass', 'ResourceSlice',
  'ServiceCIDR', 'IPAddress',
])

describe('resource templates', () => {
  it('Service matches the documented example', () => {
    expect(resourceTemplate('Service', 'apps')).toBe(`apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: apps
spec:
  selector:
    app: MyApp
  ports:
    - protocol: TCP
      port: 80
      targetPort: 9376
`)
  })

  it.each(BUILT_IN_TEMPLATE_KINDS)('%s is valid, of its kind, and already formatted', (kind) => {
    const namespaced = !CLUSTER_SCOPED.has(kind)
    const text = resourceTemplate(kind, 'team-a')!
    const result = validateManifest(text, { expectedKind: kind, namespaced })
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(result.kind).toBe(kind)
    expect(result.formatted).toBe(text)
    expect(text.includes('namespace: team-a')).toBe(namespaced || kind === 'RoleBinding')
    if (!namespaced) expect(result.namespace).toBeNull()
  })

  it('falls back to the default namespace', () => {
    expect(resourceTemplate('ConfigMap', '')).toContain('namespace: default')
  })

  it('builds a custom resource template from the CRD', () => {
    expect(customResourceTemplate({ group: 'cert-manager.io', version: 'v1', kind: 'ClusterIssuer', namespaced: false })).toBe(
      'apiVersion: cert-manager.io/v1\nkind: ClusterIssuer\nmetadata:\n  name: my-cluster-issuer\nspec: {}\n',
    )
    expect(resourceTemplate('cr:argoproj.io/applications', 'argocd', { group: 'argoproj.io', version: 'v1alpha1', kind: 'Application', namespaced: true }))
      .toContain('  namespace: argocd\n')
  })

  it('offers create only where it makes sense', () => {
    expect(canCreateKind('Service')).toBe(true)
    expect(canCreateKind('cr:argoproj.io/applications')).toBe(true)
    expect(canCreateKind('CSINode')).toBe(false)
    expect(canCreateKind('HelmRelease')).toBe(false)
  })
})

describe('validateManifest', () => {
  const svc = { expectedKind: 'Service', namespaced: true }

  it('re-indents to 2 spaces with list items under their key', () => {
    const messy = 'apiVersion: v1\nkind: Service\nmetadata:\n    name: s\n    namespace: a\nspec:\n  ports:\n  - port: 80\n'
    const r = validateManifest(messy, svc)
    expect(hasErrors(r)).toBe(false)
    expect(r.formatted).toBe('apiVersion: v1\nkind: Service\nmetadata:\n  name: s\n  namespace: a\nspec:\n  ports:\n    - port: 80\n')
  })

  it('flags tabs on every line that uses them, with line numbers', () => {
    const r = validateManifest('apiVersion: v1\nkind: Service\nmetadata:\n\tname: s\n\tnamespace: a\n', svc)
    const tabs = r.issues.filter((i) => i.message.startsWith('Tabs'))
    expect(tabs.map((i) => i.line)).toEqual([4, 5])
    expect(r.formatted).toBeNull()
  })

  it('points at a mis-indented line', () => {
    const r = validateManifest('apiVersion: v1\nkind: Service\nmetadata:\n  name: s\n   labels: x\n', svc)
    expect(hasErrors(r)).toBe(true)
    expect(r.issues[0].line).toBe(4)
    expect(r.issues[0].message).toMatch(/indent/i)
  })

  it('requires apiVersion, kind and metadata.name', () => {
    const r = validateManifest('metadata:\n  namespace: a\n', svc)
    expect(r.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining(['apiVersion is required.', 'kind is required.', 'metadata.name is required.']),
    )
  })

  it('rejects empty input and multiple documents', () => {
    expect(validateManifest('   \n# just a comment\n', svc).issues[0].message).toBe('The manifest is empty.')
    const two = resourceTemplate('Service', 'a')! + '---\n' + resourceTemplate('Service', 'a')!
    const r = validateManifest(two, svc)
    expect(r.issues.some((i) => i.message.startsWith('Found 2 YAML documents') && i.line === 13)).toBe(true)
  })

  it('flags duplicate keys', () => {
    const r = validateManifest('apiVersion: v1\nkind: Service\nkind: Pod\nmetadata:\n  name: s\n', svc)
    expect(r.issues.some((i) => i.severity === 'error' && /twice/.test(i.message) && i.line === 3)).toBe(true)
  })

  it('warns, without blocking, about a kind from another page or an odd name', () => {
    const r = validateManifest('apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: My_Config\n  namespace: a\n', svc)
    expect(hasErrors(r)).toBe(false)
    expect(r.issues.map((i) => i.severity)).toEqual(['warning', 'warning'])
  })

  it('warns that namespace is ignored on cluster-scoped kinds', () => {
    const r = validateManifest('apiVersion: v1\nkind: Namespace\nmetadata:\n  name: x\n  namespace: a\n', {
      expectedKind: 'Namespace',
      namespaced: false,
    })
    expect(r.issues).toEqual([expect.objectContaining({ severity: 'warning', line: 5 })])
  })
})
