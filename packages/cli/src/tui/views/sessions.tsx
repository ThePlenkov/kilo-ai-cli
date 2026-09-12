import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'

import { fetchCloudSession, fetchCloudSessions, renameCloudSession } from '../../api/trpc.ts'
import type { CliSession } from '../../api/types.ts'
import { useQuery } from '../hooks.ts'
import { QueryListScreen, RecordView, truncate } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

/** Cloud → Sessions: list of cloud CLI sessions. */
export function SessionsScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<CliSession>
      focused={focused}
      fetch={async () => (await fetchCloudSessions(ctx.token, { limit: 50 }, ctx.organizationId)).cliSessions}
      columns={[
        { label: 'ID', width: 14, value: (s) => s.session_id },
        { label: 'Title', width: 44, value: (s) => s.title ?? '(untitled)' },
        { label: 'Updated', width: 20, value: (s) => s.updated_at },
        { label: 'Ver', width: 4, align: 'right', value: (s) => String(s.version) },
      ]}
      onSelect={(s) => ctx.navigate('session', { id: s.session_id })}
      onBack={ctx.goBack}
      emptyText="No sessions found."
    />
  )
}

/** Cloud → Sessions → detail: record view + rename via `r`. */
export function SessionDetailScreen({ ctx, focused }: ScreenProps) {
  const id = ctx.route.params.id
  const { data, error, loading, reload } = useQuery(
    () => fetchCloudSession(ctx.token, id, ctx.organizationId),
    [ctx.token, id],
  )
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  useInput(
    (input, key) => {
      if (renaming) return
      if (key.escape) ctx.goBack()
      if (input === 'r' && !key.ctrl) setRenaming(true)
      if (input === 'R') reload()
    },
    { isActive: focused },
  )

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
      <RecordView
        data={{
          session_id: data.session_id,
          title: data.title,
          created_at: data.created_at,
          updated_at: data.updated_at,
          version: data.version,
        }}
      />
      {notice ? <Text color="green">{notice}</Text> : null}
      {renaming ? (
        <Box marginTop={1}>
          <Text>New title: </Text>
          <TextInput
            value={title}
            onChange={setTitle}
            onSubmit={async (v) => {
              setRenaming(false)
              try {
                await renameCloudSession(ctx.token, id, v, ctx.organizationId)
                setNotice(`Renamed to "${truncate(v, 60)}"`)
                reload()
              } catch (e) {
                setNotice(`Rename failed: ${e instanceof Error ? e.message : String(e)}`)
              }
            }}
          />
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor>r=rename R=refresh Esc=back</Text>
        </Box>
      )}
    </Box>
  )
}
