import type { ContainerSummary } from '@/lib/api'
import { Section, Td, Th } from './DetailPrimitives'
import { Copyable } from './Copyable'

export function ContainersTable({ title, containers }: { title: string; containers: ContainerSummary[] }) {
  if (containers.length === 0) return null
  return (
    <Section title={title}>
      <div className="overflow-hidden rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>Name</Th>
              <Th>Image</Th>
              <Th>Ports</Th>
              <Th>Env</Th>
            </tr>
          </thead>
          <tbody>
            {containers.map((c) => (
              <tr key={c.name} className="border-t border-border">
                <Td>{c.name}</Td>
                <Td className="font-mono break-all"><Copyable value={c.image} /></Td>
                <Td className="font-mono">{c.ports.length > 0 ? c.ports.join(', ') : '—'}</Td>
                <Td>{c.envCount}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
