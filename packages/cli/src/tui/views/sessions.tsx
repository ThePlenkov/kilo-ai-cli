import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import React, { useRef, useState } from 'react'

import { fetchCloudSession, fetchCloudSessions, renameCloudSession } from '../../api/trpc.ts'
import type { CliSession } from '../../api/types.ts'
import { clean, QueryListScreen, RecordView, truncate } from '../components.tsx'
import { useQuery, useTermSize } from '../hooks.ts'
import type { ScreenProps } from '../types.ts'

/** Cloud → Sessions: list of cloud CLI sessions. */
export function SessionsScreen({ ctx, focused }: ScreenProps) {
  const { columns: termColumns } = useTermSize()
  const [truncated, setTruncated] = useState(false)
  const seq = useRef(0)
  const avail = Math.max(40, termColumns - 34)
  const narrow = avail < 80
  return (
    <QueryListScreen<CliSession>
      focused={focused}
      fetch={async () => {
        const mine = ++seq.current
        const all: CliSession[] = []
        let cursor: string | undefined
        let more = false
        // Follow nextCursor until the server stops paginating (bounded to 20 pages).
        for (let i = 0; i < 20; i++) {
          // eslint-disable-next-line no-await-in-loop -- cursor pagination is sequential
          const page = await fetchCloudSessions(
            ctx.token,
            { limit: 50, cursor },
            ctx.organizationId,
          )
          all.push(...page.cliSessions)
          more = !!page.nextCursor
          if (!page.nextCursor) break
          cursor = page.nextCursor
        }
        if (mine === seq.current) setTruncated(more)
        return all
      }}
      columns={[
        { label: 'ID', width: 14, value: (s) => s.session_id },
        { label: 'Title', width: narrow ? avail - 24 : 44, value: (s) => s.title ?? '(untitled)' },
        { label: 'Updated', width: 20, value: (s) => s.updated_at.slice(0, 16).replace('T', ' ') },
        { label: 'Ver', width: 4, align: 'right', value: (s) => String(s.version) },
      ]}
      banner={() =>
        truncated ? (
          <Text color="yellow">⚠ more than 1,000 sessions — showing the most recent</Text>
        ) : null
      }
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
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)

  useInput(
    (input, key) => {
      if (key.escape) {
        if (renaming) {
          setRenaming(false)
          setTitle('')
        } else ctx.goBack()
        return
      }
      if (renaming) return
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
      {notice ? <Text color={notice.error ? 'red' : 'green'}>{clean(notice.text)}</Text> : null}
      {renaming ? (
        <Box marginTop={1}>
          <Text>New title: </Text>
          <TextInput
            value={title}
            onChange={setTitle}
            focus={focused}
            onSubmit={async (v) => {
              setRenaming(false)
              try {
                await renameCloudSession(ctx.token, id, v, ctx.organizationId)
                setNotice({ text: `Renamed to "${truncate(v, 60)}"`, error: false })
                reload()
              } catch (e) {
                setNotice({
                  text: `Rename failed: ${e instanceof Error ? e.message : String(e)}`,
                  error: true,
                })
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
