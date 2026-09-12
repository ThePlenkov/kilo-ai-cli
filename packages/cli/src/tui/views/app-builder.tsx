import React from 'react'
import { Box, Text, useInput } from 'ink'

import { checkAppBuilderEligibility, listAppBuilderProjects } from '../../api/app-builder.ts'
import type { AppBuilderProject } from '../../api/types.ts'
import { useQuery } from '../hooks.ts'
import { DataTable } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

/** Cloud → App Builder: eligibility banner + projects table. */
export function AppBuilderScreen({ ctx, focused }: ScreenProps) {
  const { data, error, loading, reload } = useQuery(async () => {
    const [eligibility, projects] = await Promise.all([
      checkAppBuilderEligibility(ctx.token).catch(() => null),
      listAppBuilderProjects(ctx.token),
    ])
    return { eligibility, projects }
  }, [ctx.token])

  useInput(
    (input, key) => {
      if (key.escape) ctx.goBack()
      if (input === 'r') reload()
    },
    { isActive: focused },
  )

  if (loading && !data) return <Text color="yellow">Loading projects…</Text>
  if (error) return <Text color="red">Error: {error}</Text>
  if (!data) return null

  const { eligibility, projects } = data
  return (
    <Box flexDirection="column">
      {eligibility ? (
        <Text color={eligibility.isEligible ? 'green' : 'yellow'}>
          {eligibility.isEligible
            ? `✓ eligible for deploy (${eligibility.accessLevel})`
            : `✗ not eligible — balance $${eligibility.balance.toFixed(2)} < min $${eligibility.minBalance}`}
        </Text>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        {projects.length === 0 ? (
          <Text>No projects found.</Text>
        ) : (
          <DataTable<AppBuilderProject>
            rows={projects}
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
          />
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>r=refresh Esc=back</Text>
      </Box>
    </Box>
  )
}
