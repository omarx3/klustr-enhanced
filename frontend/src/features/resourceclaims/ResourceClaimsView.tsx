import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ResourceClaimInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ResourceClaimInfo>()

export function ResourceClaimsView() {
  const list = useResources((s) => s.resourceClaims)
  const setList = useResources((s) => s.setResourceClaims)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('requests', { header: 'Requests', size: COL_XS }),
      columnHelper.accessor('status', { header: 'Status', size: COL_XS }),
      columnHelper.accessor('createdAt', {
        header: 'Age',
        size: COL_SM,
        cell: (info) => formatAge(info.getValue()),
        sortingFn: 'datetime',
      }),
    ],
    [],
  )

  return (
    <ResourceTable
      kind="ResourceClaim"
      noun={{ singular: 'resource claim', plural: 'resource claims' }}
      scope="namespaced"
      data={list}
      setData={setList}
      fetch={api.listResourceClaims}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({
          kind: 'ResourceClaim',
          namespace: row.namespace,
          name: row.name,
          context: ctx,
        })
      }
    />
  )
}
