import React from 'react'
import { Box, Text, useInput, useStdout } from 'ink'

import { fetchProfileWithBalance } from '../../api/profile.ts'
import { useQuery } from '../hooks.ts'
import { RecordView } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

/** Dashboard → Your Profile: profile record + balance + organizations. */
export function ProfileScreen({ ctx, focused }: ScreenProps) {
  const { stdout } = useStdout()
  // Cap the organizations list so the footer stays inside the clipped pane.
  const maxOrgs = Math.max(2, (stdout?.rows ?? 24) - 16)
  const { data, error, loading, reload } = useQuery(
    () => fetchProfileWithBalance(ctx.token, ctx.organizationId),
    [ctx.token, ctx.organizationId],
  )

  useInput(
    (input, key) => {
      if (key.escape) ctx.goBack()
      if (input === 'r') reload()
    },
    { isActive: focused },
  )

  if (loading && !data) return <Text color="yellow">Loading profile…</Text>
  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>r=retry Esc=back</Text>
      </Box>
    )
    }
  if (!data) return null

  const { profile, balance } = data
  return (
    <Box flexDirection="column">
      <RecordView
        data={{
          email: profile.email,
          name: profile.name,
          balance: balance ? `$${balance.balance.toFixed(2)}` : 'unavailable',
          hasPersonalAccount: profile.hasPersonalAccount,
          selectedOrganizationId: profile.selectedOrganizationId,
        }}
      />
      {profile.organizations && profile.organizations.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Organizations</Text>
          {profile.organizations.slice(0, maxOrgs).map((o) => (
            <Text key={o.id}>
              {'  '}
              {o.name} <Text dimColor>({o.role})</Text>
            </Text>
          ))}
          {profile.organizations.length > maxOrgs ? (
            <Text dimColor>{'  '}… {profile.organizations.length - maxOrgs} more</Text>
          ) : null}
        </Box>
      ) : (
        <Text dimColor>No organizations — `kilo-ai-cli org create` to make one.</Text>
      )}
      <Box marginTop={1}>
        <Text dimColor>r=refresh Esc=back</Text>
      </Box>
    </Box>
  )
}
