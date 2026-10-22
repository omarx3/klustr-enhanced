import { isMap, isSeq, parseDocument, type Document } from 'yaml'

export const DUPLICATE_PREFIX = 'copy-of-'

export function duplicateName(name: string): string {
  return `${DUPLICATE_PREFIX}${name}`
}

// Annotations that tie an object to the original's history or to a tool that
// manages it. Copying them would let Argo CD prune the copy as an orphan of its
// app, or show the original's last kubectl apply as the copy's.
const DROPPED_ANNOTATIONS = [
  'kubectl.kubernetes.io/last-applied-configuration',
  'deployment.kubernetes.io/revision',
  'argocd.argoproj.io/tracking-id',
  'pv.kubernetes.io/bind-completed',
  'pv.kubernetes.io/bound-by-controller',
  'volume.kubernetes.io/selected-node',
]

// Labels the Job controller stamps from the original Job's uid and name. The
// apiserver rejects a new Job whose selector it did not generate.
const JOB_GENERATED_LABELS = [
  'controller-uid',
  'batch.kubernetes.io/controller-uid',
  'job-name',
  'batch.kubernetes.io/job-name',
]

// Removes keys from the map at path, then drops the maps the removal left
// empty, walking up while the path is deeper than keepDepth. With the default
// of 1, top-level fields such as metadata and spec always stay.
function deleteKeys(doc: Document, path: string[], keys: string[], keepDepth = 1) {
  const node = doc.getIn(path, true)
  if (!isMap(node)) return
  for (const k of keys) node.delete(k)
  for (let p = path; p.length > keepDepth; p = p.slice(0, -1)) {
    const n = doc.getIn(p, true)
    if (!isMap(n) || n.items.length > 0) break
    doc.deleteIn(p)
  }
}

// Turns the YAML of a live object into a manifest for a new copy of it, named
// copy-of-<name>. The backend has already dropped uid, resourceVersion, status,
// managedFields and ownerReferences; this removes the fields that would make
// the create fail or collide with the original, and keeps everything else as
// it is so the user edits the same manifest.
export function duplicateManifest(yamlText: string): { manifest: string; kind: string; name: string } {
  const doc = parseDocument(yamlText)
  if (doc.errors.length > 0) throw new Error(doc.errors[0].message)
  const kind = String(doc.getIn(['kind']) ?? '')
  const original = String(doc.getIn(['metadata', 'name']) ?? '')
  if (!kind || !original) throw new Error('The manifest has no kind or name')
  const name = duplicateName(original)

  doc.setIn(['metadata', 'name'], name)
  doc.deleteIn(['metadata', 'generateName'])
  deleteKeys(doc, ['metadata', 'annotations'], DROPPED_ANNOTATIONS)

  const apiGroup = String(doc.getIn(['apiVersion']) ?? '').split('/')
  const core = apiGroup.length === 1
  switch (core ? kind : `${kind}.${apiGroup[0]}`) {
    case 'Service': {
      // The allocated IPs and node ports belong to the original; a headless
      // Service keeps its "None".
      if (doc.getIn(['spec', 'clusterIP']) !== 'None') {
        doc.deleteIn(['spec', 'clusterIP'])
        doc.deleteIn(['spec', 'clusterIPs'])
      }
      doc.deleteIn(['spec', 'healthCheckNodePort'])
      const ports = doc.getIn(['spec', 'ports'], true)
      if (isSeq(ports)) for (const p of ports.items) if (isMap(p)) p.delete('nodePort')
      break
    }
    case 'PersistentVolumeClaim':
      // Bound to the original's volume; the copy gets its own.
      doc.deleteIn(['spec', 'volumeName'])
      break
    case 'PersistentVolume':
      doc.deleteIn(['spec', 'claimRef'])
      break
    case 'Pod':
      doc.deleteIn(['spec', 'nodeName'])
      // Ephemeral containers cannot be set on create.
      doc.deleteIn(['spec', 'ephemeralContainers'])
      // A ReplicaSet would adopt a copy that still carries its hash label.
      deleteKeys(doc, ['metadata', 'labels'], ['pod-template-hash'])
      break
    case 'Job.batch':
      if (doc.getIn(['spec', 'manualSelector']) !== true) doc.deleteIn(['spec', 'selector'])
      deleteKeys(doc, ['metadata', 'labels'], JOB_GENERATED_LABELS)
      deleteKeys(doc, ['spec', 'template', 'metadata', 'labels'], JOB_GENERATED_LABELS)
      break
  }

  return {
    manifest: doc.toString({ indent: 2, indentSeq: true, lineWidth: 0, flowCollectionPadding: false }),
    kind,
    name,
  }
}
