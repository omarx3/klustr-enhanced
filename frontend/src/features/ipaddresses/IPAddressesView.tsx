import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type IPAddressInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<IPAddressInfo>()

export function IPAddressesView() {
  const list = useResources((s) => s.ipAddresses)
  const setList = useResources((s) => s.setIPAddresses)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'IP' }),
      columnHelper.accessor('parentRef', { header: 'Parent' }),
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
      kind="IPAddress"
      noun={{ singular: 'IP address', plural: 'IP addresses' }}
      scope="cluster"
      data={list}
      setData={setList}
      fetch={(ctx) => api.listIPAddresses(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({ kind: 'IPAddress', namespace: '', name: row.name, context: ctx })
      }
    />
  )
}
