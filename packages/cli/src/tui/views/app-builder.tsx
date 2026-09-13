import React, { useState } from 'react'
import { Text } from 'ink'

import { checkAppBuilderEligibility, listAppBuilderProjects } from '../../api/app-builder.ts'
import type { AppBuilderEligibility, AppBuilderProject } from '../../api/types.ts'
import { QueryListScreen } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

/** Cloud → App Builder: eligibility banner + scrollable projects table. */
export function AppBuilderScreen({ ctx, focused }: ScreenProps) {
  const [eligibility, setEligibility] = useState<AppBuilderEligibility | null>(null)

  return (
    <QueryListScreen<AppBuilderProject>
      focused={focused}
      fetch={async () => {
        const [e, projects] = await Promise.all([
          checkAppBuilderEligibility(ctx.token).catch(() => null),
          listAppBuilderProjects(ctx.token),
        ])
        setEligibility(e)
        return projects
      }}
      columns={[
        { label: 'ID', width: 14, value: (p) => p.id },
        { label: 'Name', width: 30, value: (p) => p.name },
        {
          label: 'Status',
          width: 12,
          value: (p) => p.status,
          color: (p) => (p.status === 'deployed' ? 'green' : p.status === 'failed' ? 'red' : 'yellow'),
        },
        { label: 'URL', width: 40, value: (p) => p.url ?? '-' },
      ]}
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
