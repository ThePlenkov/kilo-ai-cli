import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'

import { getCloudAgentSession, listGitHubRepositories, listGitLabRepositories } from '../../api/cloud-agent.ts'
import type { CloudAgentRepository, CloudAgentSession } from '../../api/types.ts'
import { useQuery } from '../hooks.ts'
import { QueryListScreen, RecordView } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

/** Cloud → Cloud Agent repos (GitHub or GitLab). */
export function CloudAgentReposScreen({ ctx, focused, provider }: ScreenProps & { provider: 'github' | 'gitlab' }) {
  return (
    <QueryListScreen<CloudAgentRepository>
      focused={focused}
      fetch={() =>
        provider === 'gitlab'
          ? listGitLabRepositories(ctx.token)
          : listGitHubRepositories(ctx.token)
      }
      columns={[
        { label: 'Name', width: 40, value: (r) => r.fullName || r.name },
        { label: 'Branch', width: 14, value: (r) => r.defaultBranch ?? '-' },
        {
          label: 'Private',
          width: 8,
          value: (r) => (r.private ? 'yes' : 'no'),
          color: (r) => (r.private ? 'yellow' : 'gray'),
        },
      ]}
      banner={() => <Text dimColor>provider: {provider}</Text>}
      onBack={ctx.goBack}
      emptyText={`No ${provider} repositories — is the ${provider} integration connected?`}
    />
  )
}

/** Cloud → Cloud Agent session lookup by ID (prompts for input first). */
export function CloudAgentSessionScreen({ ctx, focused }: ScreenProps) {
  const [input, setInput] = useState(ctx.route.params.id ?? '')
  const [submitted, setSubmitted] = useState<string | null>(ctx.route.params.id ?? null)

  useInput(
    (_i, key) => {
      if (submitted) return
      if (key.escape) ctx.goBack()
    },
    { isActive: focused },
  )

  if (!submitted) {
    return (
      <Box flexDirection="column">
        <Text bold>Cloud Agent session lookup</Text>
        <Box>
          <Text>Session ID: </Text>
          <TextInput
            value={input}
            onChange={setInput}
            focus={focused}
            onSubmit={(v) => {
              if (v.trim()) setSubmitted(v.trim())
            }}
          />
        </Box>
        <Text dimColor>Enter=fetch Esc=back</Text>
      </Box>
    )
  }

  return <CloudAgentSessionRecord ctx={ctx} focused={focused} sessionId={submitted} />
}

function CloudAgentSessionRecord({ ctx, focused, sessionId }: ScreenProps & { sessionId: string }) {
  const { data, error, loading } = useQuery(
    () => getCloudAgentSession(ctx.token, sessionId),
    [ctx.token, sessionId],
  )
  useInput((_i, key) => {
    if (key.escape) ctx.goBack()
  }, { isActive: focused })

  if (loading && !data) return <Text color="yellow">Loading session…</Text>
  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Esc=back</Text>
      </Box>
    )
  }
  if (!data) return null
  return (
    <Box flexDirection="column">
      <RecordView data={data as CloudAgentSession as unknown as Record<string, unknown>} />
      <Box marginTop={1}>
        <Text dimColor>Esc=back</Text>
      </Box>
    </Box>
  )
}
