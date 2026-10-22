import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { api, type AdmissionPolicyInfo } from '@/lib/api'
import { formatAge } from '@/lib/time'
import { ResourceTable } from '@/features/_shared/ResourceTable'
import { COL_SM, COL_XS } from '@/features/_shared/columnSizes'
import { useResources } from '@/store/resources'
import { useUIStore } from '@/store/ui'

const columnHelper = createColumnHelper<AdmissionPolicyInfo>()

export function ValidatingAdmissionPoliciesView() {
  const list = useResources((s) => s.validatingAdmissionPolicies)
  const setList = useResources((s) => s.setValidatingAdmissionPolicies)
  const setSelectedResource = useUIStore((s) => s.setSelectedResource)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('failPolicy', { header: 'Failure', size: COL_XS }),
      columnHelper.accessor('paramKind', { header: 'Param kind' }),
      columnHelper.accessor('validations', { header: 'Rules', size: COL_XS }),
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
      kind="ValidatingAdmissionPolicy"
      noun={{ singular: 'validating admission policy', plural: 'validating admission policies' }}
      scope="cluster"
      data={list}
      setData={setList}
      fetch={(ctx) => api.listValidatingAdmissionPolicies(ctx)}
      columns={columns}
      onRowClick={(row, ctx) =>
        setSelectedResource({
          kind: 'ValidatingAdmissionPolicy',
          namespace: '',
          name: row.name,
          context: ctx,
        })
      }
    />
  )
}
