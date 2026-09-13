/** Shared TUI building blocks: tables, list screens, record views, sidebar. */

import React, { useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'

import { useQuery } from './hooks.ts'

export function truncate(s: string, width: number): string {
  return s.length > width ? s.slice(0, Math.max(1, width - 1)) + '…' : s
}

function pad(s: string, width: number): string {
  return truncate(s, width).padEnd(width)
}

function padRight(s: string, width: number): string {
  return truncate(s, width).padStart(width)
}

// ---------------------------------------------------------------------------
// DataTable — generic selectable table
// ---------------------------------------------------------------------------

export interface Column<T> {
  label: string
  width: number
  align?: 'left' | 'right'
  value: (row: T) => string
  color?: (row: T) => string | undefined
}

export function DataTable<T>({
  rows,
  columns,
  selected,
}: {
  rows: T[]
  columns: Column<T>[]
  selected?: number
}) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text>{'  '}</Text>
        {columns.map((c, i) => (
          <Text key={c.label} bold>
            {(c.align === 'right' ? padRight(c.label, c.width) : pad(c.label, c.width)) + (i < columns.length - 1 ? '  ' : '')}
          </Text>
        ))}
      </Box>
      <Box>
        <Text>{'  '}</Text>
        <Text dimColor>{columns.map((c) => '─'.repeat(c.width)).join('  ')}</Text>
      </Box>
      {rows.map((row, i) => (
        <Box key={i}>
          <Text color={i === selected ? 'cyan' : undefined}>{i === selected ? '› ' : '  '}</Text>
          {columns.map((c, j) => {
            const raw = c.value(row)
            const text = (c.align === 'right' ? padRight(raw, c.width) : pad(raw, c.width)) + (j < columns.length - 1 ? '  ' : '')
            return (
              <Text key={c.label} color={c.color?.(row)}>
                {text}
              </Text>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// QueryListScreen — fetch array → scrollable selectable table
// ---------------------------------------------------------------------------

/** Lines reserved for app header/footer, screen title, hints and scroll markers. */
const RESERVED_LINES = 11

export interface QueryListScreenProps<T> {
  focused: boolean
  fetch: () => Promise<T[]>
  columns: Column<T>[]
  onSelect?: (row: T) => void
  onBack: () => void
  emptyText?: string
  /** Extra hint appended to the help line, e.g. "f=filter". */
  help?: string
  /** Custom key handler; return true if the key was consumed. */
  onKey?: (input: string, key: { return?: boolean; escape?: boolean }, selected: T | undefined) => boolean
  /** Optional summary line rendered above the table. */
  banner?: (data: T[]) => React.ReactNode
}

export function QueryListScreen<T>(props: QueryListScreenProps<T>) {
  const { focused, fetch, columns, onSelect, onBack, emptyText, help, onKey, banner } = props
  const { stdout } = useStdout()
  const maxVisible = Math.max(3, (stdout?.rows ?? 24) - RESERVED_LINES)

  const { data, error, loading, reload } = useQuery(fetch, [])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)

  const rows = data ?? []
  // Clamp after data shrinks (e.g. refresh returns fewer rows).
  const selIdx = Math.min(selectedIdx, Math.max(0, rows.length - 1))
  const offset = Math.min(scrollOffset, Math.max(0, rows.length - maxVisible))
  const selected = rows[selIdx]

  useInput(
    (input, key) => {
      if (key.escape) {
        onBack()
        return
      }
      if (input === 'r' && !key.ctrl) {
        reload()
        return
      }
      if (onKey?.(input, key, selected)) return
      if (key.upArrow) {
        const i = Math.max(0, selIdx - 1)
        setSelectedIdx(i)
        if (i < offset) setScrollOffset(i)
      }
      if (key.downArrow) {
        const i = Math.min(rows.length - 1, selIdx + 1)
        setSelectedIdx(i)
        if (i >= offset + maxVisible) setScrollOffset(i - maxVisible + 1)
      }
      if (key.return && selected) onSelect?.(selected)
    },
    { isActive: focused },
  )

  if (loading && !data) return <Text color="yellow">Loading…</Text>
  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>r=retry  Esc=back</Text>
      </Box>
    )
  }
  if (rows.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>{emptyText ?? 'Nothing found.'}</Text>
        <Text dimColor>r=refresh  Esc=back</Text>
      </Box>
    )
  }

  const visible = rows.slice(offset, offset + maxVisible)
  return (
    <Box flexDirection="column">
      {banner ? <Box marginBottom={1}>{banner(rows)}</Box> : null}
      {offset > 0 ? <Text dimColor>  ↑ {offset} more</Text> : null}
      <DataTable rows={visible} columns={columns} selected={selIdx - offset} />
      {offset + maxVisible < rows.length ? (
        <Text dimColor>  ↓ {rows.length - offset - maxVisible} more</Text>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>
          [{selIdx + 1}/{rows.length}] ↑↓ navigate{onSelect ? '  Enter=open' : ''}  r=refresh{help ? `  ${help}` : ''}  Esc=back
        </Text>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// RecordView — key/value rendering of a single object
// ---------------------------------------------------------------------------

export function RecordView({ data, width = 22 }: { data: Record<string, unknown>; width?: number }) {
  return (
    <Box flexDirection="column">
      {Object.entries(data).map(([k, v]) => {
        if (v === undefined || v === null) return null
        const text = typeof v === 'object' ? JSON.stringify(v) : String(v)
        return (
          <Box key={k}>
            <Box width={width}>
              <Text dimColor>{k}:</Text>
            </Box>
            <Text>{text}</Text>
          </Box>
        )
      })}
    </Box>
  )
}

export function QueryRecordScreen({
  focused,
  fetch,
  onBack,
  emptyText,
}: {
  focused: boolean
  fetch: () => Promise<Record<string, unknown>>
  onBack: () => void
  emptyText?: string
}) {
  const { data, error, loading, reload } = useQuery(fetch, [])
  useInput(
    (input, key) => {
      if (key.escape) onBack()
      if (input === 'r') reload()
    },
    { isActive: focused },
  )
  if (loading && !data) return <Text color="yellow">Loading…</Text>
  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>r=retry  Esc=back</Text>
      </Box>
    )
  }
  if (!data || Object.keys(data).length === 0) return <Text>{emptyText ?? 'No data.'}</Text>
  return (
    <Box flexDirection="column">
      <RecordView data={data} />
      <Box marginTop={1}>
        <Text dimColor>r=refresh  Esc=back</Text>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// TextScreen — scrollable plain-text content (file viewer, changelog body)
// ---------------------------------------------------------------------------

export function TextScreen({
  focused,
  fetch,
  onBack,
}: {
  focused: boolean
  fetch: () => Promise<string>
  onBack: () => void
}) {
  const { stdout } = useStdout()
  const maxVisible = Math.max(3, (stdout?.rows ?? 24) - RESERVED_LINES)
  const { data, error, loading } = useQuery(fetch, [])
  const [offset, setOffset] = useState(0)

  const lines = (data ?? '').split('\n')
  useInput(
    (_input, key) => {
      if (key.escape) onBack()
      if (key.upArrow) setOffset((o) => Math.max(0, o - 1))
      if (key.downArrow) setOffset((o) => Math.min(Math.max(0, lines.length - maxVisible), o + 1))
      if (key.pageDown) setOffset((o) => Math.min(Math.max(0, lines.length - maxVisible), o + maxVisible))
      if (key.pageUp) setOffset((o) => Math.max(0, o - maxVisible))
    },
    { isActive: focused },
  )

  if (loading && !data) return <Text color="yellow">Loading…</Text>
  if (error) return <Text color="red">Error: {error}</Text>
  return (
    <Box flexDirection="column">
      {lines.slice(offset, offset + maxVisible).map((l, i) => (
        <Text key={offset + i} wrap="truncate">
          {l}
        </Text>
      ))}
      <Box marginTop={1}>
        <Text dimColor>
          [{offset + 1}-{Math.min(offset + maxVisible, lines.length)}/{lines.length}] ↑↓ scroll  Esc=back
        </Text>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Sidebar — website-style grouped navigation
// ---------------------------------------------------------------------------

export interface SidebarItem {
  name: string
  title: string
  active: boolean
}

type SidebarEntry = { kind: 'group'; title: string } | { kind: 'item'; item: SidebarItem; flat: number }

export function Sidebar({
  groups,
  selected,
  focused,
  width = 26,
  height,
}: {
  groups: { title: string; items: SidebarItem[] }[]
  /** Flat index across all groups. */
  selected: number
  focused: boolean
  width?: number
  /** Max content lines (excl. border). Window scrolls to keep `selected` visible. */
  height?: number
}) {
  const entries: SidebarEntry[] = []
  let flat = -1
  for (const g of groups) {
    entries.push({ kind: 'group', title: g.title })
    for (const item of g.items) {
      flat += 1
      entries.push({ kind: 'item', item, flat })
    }
  }

  const selEntry = Math.max(
    0,
    entries.findIndex((e) => e.kind === 'item' && e.flat === selected),
  )
  const visible = Math.max(3, height ?? entries.length)
  const start = Math.max(0, Math.min(selEntry - Math.floor(visible / 2), entries.length - visible))
  const window = entries.slice(start, start + visible)

  return (
    <Box flexDirection="column" width={width} height={visible + 2} borderStyle="single" borderColor={focused ? 'cyan' : 'gray'} paddingX={1} overflow="hidden">
      {start > 0 ? <Text dimColor>  ↑ {start} more</Text> : null}
      {window.map((e, i) => {
        if (e.kind === 'group') {
          return (
            <Text key={`g${i}`} bold dimColor>
              {e.title}
            </Text>
          )
        }
        const isSel = e.flat === selected
        return (
          <Text
            key={e.item.name}
            color={isSel ? 'cyan' : undefined}
            bold={isSel && focused}
            dimColor={!isSel && !e.item.active}
          >
            {isSel ? '› ' : '  '}
            {truncate(e.item.title, width - 5)}
            {e.item.active ? ' ●' : ''}
          </Text>
        )
      })}
      {start + visible < entries.length ? <Text dimColor>  ↓ {entries.length - start - visible} more</Text> : null}
    </Box>
  )
}
