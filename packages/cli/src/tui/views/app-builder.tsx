import { Text } from 'ink'
import React, { useRef, useState } from 'react'

import { checkAppBuilderEligibility, listAppBuilderProjects } from '../../api/app-builder.ts'
import type { AppBuilderEligibility, AppBuilderProject } from '../../api/types.ts'
import type { Column } from '../components.tsx'
import { QueryListScreen } from '../components.tsx'
import { useTermSize } from '../hooks.ts'
import type { ScreenProps } from '../types.ts'

/** Cloud → App Builder: eligibility banner + scrollable projects table. */
export function AppBuilderScreen({ ctx, focused }: ScreenProps) {
  const { columns: termColumns } = useTermSize()
  const [eligibility, setEligibility] = useState<AppBuilderEligibility | null>(null)
  // Guards the side-channel eligibility state against overlapping refreshes —
  // useQuery already protects its own data, this protects the side effect.
  const seq = useRef(0)

  // Content pane is ~34 columns narrower than the terminal.
  const avail = Math.max(40, termColumns - 34)
  const narrow = avail < 76

  const columns: Column<AppBuilderProject>[] = [
    { label: 'ID', width: 14, value: (p) => p.id },
    { label: 'Name', width: narrow ? 22 : 30, value: (p) => p.name },
    {
      label: 'Status',
      width: 12,
      value: (p) => p.status,
      color: (p) => (p.status === 'deployed' ? 'green' : p.status === 'failed' ? 'red' : 'yellow'),
    },
  ]
  if (!narrow) columns.push({ label: 'URL', width: 40, value: (p) => p.url ?? '-' })

  return (
    <QueryListScreen<AppBuilderProject>
      focused={focused}
      fetch={async () => {
        const mine = ++seq.current
        const [e, projects] = await Promise.all([
          checkAppBuilderEligibility(ctx.token).catch(() => null),
          listAppBuilderProjects(ctx.token),
        ])
        if (mine === seq.current) setEligibility(e)
        return projects
      }}
      columns={columns}
      banner={() =>
        eligibility ? (
          <Text color={eligibility.isEligible ? 'green' : 'yellow'}>
            {eligibility.isEligible
              ? `✓ eligible for deploy (${eligibility.accessLevel})`
              : `✗ not eligible — balance $${eligibility.balance.toFixed(2)} < min $${eligibility.minBalance}`}
          </Text>
        ) : null
      }
      onBack={ctx.goBack}
      emptyText="No projects found."
    />
  )
}
