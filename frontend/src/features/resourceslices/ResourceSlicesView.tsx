import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type ResourceSliceInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<ResourceSliceInfo>()

export function ResourceSlicesView() {
  const list = useResources((s) => s.resourceSlices)
  const setList = useResources((s) => s.setResourceSlices)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('driver', { header: 'Driver' }),
      columnHelper.accessor('pool', { header: 'Pool' }),
      columnHelper.accessor('nodeName', { header: 'Node' }),
      columnHelper.accessor('devices', { header: 'Devices', size: COL_XS }),
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
      kind="ResourceSlice"
      noun={{ singular: 'resource slice', plural: 'resource slices' }}
      scope="cluster"
      data={list}
      setData={setList}
      fetch={(ctx) => api.listResourceSlices(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'ResourceSlice', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
