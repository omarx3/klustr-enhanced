import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type AdmissionPolicyBindingInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<AdmissionPolicyBindingInfo>()

export function MutatingAdmissionPolicyBindingsView() {
  const list = useResources((s) => s.mutatingAdmissionPolicyBindings)
  const setList = useResources((s) => s.setMutatingAdmissionPolicyBindings)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('policyName', { header: 'Policy' }),
      columnHelper.accessor('paramRef', { header: 'Param ref' }),
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
      kind="MutatingAdmissionPolicyBinding"
      noun={{
        singular: 'mutating admission policy binding',
        plural: 'mutating admission policy bindings',
      }}
      scope="cluster"
      data={list}
      setData={setList}
      fetch={(ctx) => api.listMutatingAdmissionPolicyBindings(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({
          kind: 'MutatingAdmissionPolicyBinding',
          namespace: '',
          name: row.name,
          context: ctx,
        })
      }
    />
  )
}
