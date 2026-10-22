import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type AdmissionPolicyBindingInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<AdmissionPolicyBindingInfo>()

export function ValidatingAdmissionPolicyBindingsView() {
  const list = useResources((s) => s.validatingAdmissionPolicyBindings)
  const setList = useResources((s) => s.setValidatingAdmissionPolicyBindings)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('policyName', { header: 'Policy' }),
      columnHelper.accessor('paramRef', { header: 'Param ref' }),
      columnHelper.accessor('actions', { header: 'Actions', size: COL_XS }),
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
      kind="ValidatingAdmissionPolicyBinding"
      noun={{
        singular: 'validating admission policy binding',
        plural: 'validating admission policy bindings',
      }}
      scope="cluster"
      data={list}
      setData={setList}
      fetch={(ctx) => api.listValidatingAdmissionPolicyBindings(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({
          kind: 'ValidatingAdmissionPolicyBinding',
          namespace: '',
          name: row.name,
          context: ctx,
        })
      }
    />
  )
}
