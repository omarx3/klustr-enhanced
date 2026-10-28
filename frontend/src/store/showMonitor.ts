import { useDeploymentMonitors } from './deploymentMonitors'
import { useUIStore } from './ui'

// Opens the Monitor page with the given monitor highlighted. Kept apart from
// deploymentMonitors.ts so that store does not import the UI store.
export function showMonitor(key: string) {
  useUIStore.getState().setSelectedView('monitor')
  useDeploymentMonitors.getState().focus(key)
}
