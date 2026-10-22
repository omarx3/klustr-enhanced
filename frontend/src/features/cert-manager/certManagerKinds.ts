import type { SelectedResource } from '@/store/ui'

// Group + resources of the cert-manager kinds Klustr surfaces. The frontend
// uses these to call api.ensureCustomResourceWatch and look up CRDs in the
// cache; dispatch sticks to the bare CR kinds ("Certificate", "Issuer",
// "ClusterIssuer") plus the group guard so they never collide with anything
// else.
export const CERT_MANAGER_GROUP = 'cert-manager.io'
// Order and Challenge live under the ACME-specific group; present only when an
// ACME issuer is configured.
export const CERT_MANAGER_ACME_GROUP = 'acme.cert-manager.io'

export const CERT_MANAGER_CERTIFICATE_RESOURCE = 'certificates'
export const CERT_MANAGER_ISSUER_RESOURCE = 'issuers'
export const CERT_MANAGER_CLUSTERISSUER_RESOURCE = 'clusterissuers'
export const CERT_MANAGER_CERTIFICATEREQUEST_RESOURCE = 'certificaterequests'
export const CERT_MANAGER_ORDER_RESOURCE = 'orders'
export const CERT_MANAGER_CHALLENGE_RESOURCE = 'challenges'

export function isCertManagerCertificate(
  resource: SelectedResource | null,
): boolean {
  return (
    resource !== null &&
    resource.kind === 'Certificate' &&
    resource.gvr?.group === CERT_MANAGER_GROUP
  )
}
