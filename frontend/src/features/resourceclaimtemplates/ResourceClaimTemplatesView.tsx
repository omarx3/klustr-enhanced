import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ResourceClaimTemplateInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_MD, COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ResourceClaimTemplateInfo>()

export function ResourceClaimTemplatesView() {
  const list = useResources((s) => s.resourceClaimTemplates)
  const setList = useResources((s) => s.setResourceClaimTemplates)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('namespace', { header: 'Namespace', size: COL_MD }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('requests', { header: 'Requests', size: COL_XS }),
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
      kind="ResourceClaimTemplate"
      noun={{ singular: 'resource claim template', plural: 'resource claim templates' }}
      scope="namespaced"
      data={list}
      setData={setList}
      fetch={api.listResourceClaimTemplates}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({
          kind: 'ResourceClaimTemplate',
          namespace: row.namespace,
          name: row.name,
          context: ctx,
        })
      }
    />
  )
}
