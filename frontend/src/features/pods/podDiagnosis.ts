import type { ContainerDetail, PodDetail } from '@/lib/api'

export type DiagnosisSeverity = 'error' | 'warning'

export type DiagnosisItem = {
  severity: DiagnosisSeverity
  title: string
  detail: string
}

// Waiting reasons that are a normal part of startup, not a fault.
const TRANSIENT_WAITING = new Set(['ContainerCreating', 'PodInitializing'])

const IMAGE_PULL_REASONS = new Set([
  'ImagePullBackOff',
  'ErrImagePull',
  'InvalidImageName',
  'ImageInspectError',
  'ErrImageNeverPull',
])

const CONFIG_REASONS = new Set([
  'CreateContainerConfigError',
  'CreateContainerError',
  'RunContainerError',
])

const HIGH_RESTART_COUNT = 5

const times = (n: number) => `${n} time${n === 1 ? '' : 's'}`

function containerIssues(c: ContainerDetail, kind: 'init' | 'container'): DiagnosisItem[] {
  const label = kind === 'init' ? 'init container' : 'container'

  if (c.state === 'Waiting' && c.stateReason && !TRANSIENT_WAITING.has(c.stateReason)) {
    if (c.stateReason === 'CrashLoopBackOff') {
      const last = c.lastState ? ` Last exit: ${c.lastState}.` : ''
      return [{
        severity: 'error',
        title: `${c.name}: CrashLoopBackOff`,
        detail: `This ${label} keeps crashing and is being restarted with backoff (restarted ${times(c.restartCount)}).${last} Check its logs and last exit reason.`,
      }]
    }
    if (IMAGE_PULL_REASONS.has(c.stateReason)) {
      return [{
        severity: 'error',
        title: `${c.name}: ${c.stateReason}`,
        detail: `The image "${c.image}" could not be pulled. Check the image name and tag, and registry credentials (imagePullSecrets).`,
      }]
    }
    if (CONFIG_REASONS.has(c.stateReason)) {
      return [{
        severity: 'error',
        title: `${c.name}: ${c.stateReason}`,
        detail: `This ${label} could not start. Check its referenced ConfigMaps, Secrets, volume mounts, and command.`,
      }]
    }
    return [{
      severity: 'warning',
      title: `${c.name}: ${c.stateReason}`,
      detail: `This ${label} is waiting (${c.stateReason}).`,
    }]
  }

  if (c.state === 'Terminated' && c.stateReason) {
    if (c.stateReason === 'OOMKilled') {
      return [{
        severity: 'error',
        title: `${c.name}: OOMKilled`,
        detail: `This ${label} was killed for exceeding its memory limit. Raise the memory limit or reduce its usage.`,
      }]
    }
    if (c.stateReason !== 'Completed') {
      return [{
        severity: 'error',
        title: `${c.name}: ${c.stateReason}`,
        detail: `This ${label} terminated unexpectedly (${c.stateReason}). Check its logs.`,
      }]
    }
    return []
  }

  // Currently up but it has crashed before — surface a flapping container.
  if (c.lastState === 'OOMKilled') {
    return [{
      severity: 'warning',
      title: `${c.name}: previously OOMKilled`,
      detail: `This ${label} has restarted ${times(c.restartCount)} and was last killed for exceeding its memory limit. Consider raising the memory limit.`,
    }]
  }
  if (c.restartCount >= HIGH_RESTART_COUNT) {
    const last = c.lastState ? ` Last exit: ${c.lastState}.` : ''
    return [{
      severity: 'warning',
      title: `${c.name}: ${c.restartCount} restarts`,
      detail: `This ${label} has restarted ${times(c.restartCount)}.${last} Check its logs for a recurring failure.`,
    }]
  }

  return []
}

// podDiagnosis turns a pod's already-fetched status into plain-language findings:
// what is wrong and what to check. Deterministic and offline — no LLM, no extra
// API calls (the scheduling reason comes from the PodScheduled condition message).
export function podDiagnosis(detail: PodDetail): DiagnosisItem[] {
  const items: DiagnosisItem[] = []

  if (detail.phase === 'Pending') {
    const sched = detail.conditions.find((c) => c.type === 'PodScheduled' && c.status === 'False')
    if (sched) {
      items.push({
        severity: 'error',
        title: 'Pending — not scheduled',
        detail: sched.message
          ? `The scheduler could not place this pod: ${sched.message}`
          : `The scheduler could not place this pod${sched.reason ? ` (${sched.reason})` : ''}. Check node capacity, taints/tolerations, affinity rules, and PVC binding.`,
      })
    }
  }

  for (const c of detail.initContainers) items.push(...containerIssues(c, 'init'))
  for (const c of detail.containers) items.push(...containerIssues(c, 'container'))

  return items
}
