import { Box, Text, useInput } from 'ink'
import SelectInput from 'ink-select-input'
import React, { useEffect, useRef, useState } from 'react'

import { getSecurityRepositories, listFindings } from '../../api/security-agent.ts'
import type {
  SecurityAgentRepository,
  SecurityFinding,
  SecurityFindingsResult,
} from '../../api/types.ts'
import { useTermSize } from '../hooks.ts'
import type { FindingsFilter } from '../types.ts'

export interface FindingsListViewProps {
  token: string
  filter: FindingsFilter
  onFilterChange: (f: FindingsFilter) => void
  onSelectFinding: (id: string) => void
  onBack: () => void
  focused: boolean
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'yellow',
  medium: 'blue',
  low: 'gray',
  info: 'gray',
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

type FilterMode = 'none' | 'severity' | 'status' | 'sort' | 'columns' | 'repo'

/** Lines reserved for header, filters, help bar, scroll indicators, etc. */
const RESERVED_LINES = 10

/* ------------------------------------------------------------------ */
/* Column definitions                                                  */
/* ------------------------------------------------------------------ */

interface CellProps {
  text: string
  color?: string
  bold?: boolean
  dim?: boolean
}

interface TuiColumnDef {
  label: string
  width: number
  render: (f: SecurityFinding) => CellProps
  sortValue: (f: SecurityFinding) => string | number
}

const TUI_COLUMNS: Record<string, TuiColumnDef> = {
  severity: {
    label: 'Severity',
    width: 9,
    render: (f) => ({
      text: f.severity,
      color: SEVERITY_COLORS[f.severity] ?? 'white',
      bold: true,
    }),
    sortValue: (f) => SEVERITY_ORDER[f.severity] ?? 99,
  },
  title: {
    label: 'Title',
    width: 50,
    render: (f) => ({ text: f.title }),
    sortValue: (f) => f.title,
  },
  repo: {
    label: 'Repository',
    width: 28,
    render: (f) => ({ text: f.repoFullName ?? f.repo_full_name ?? '-', dim: true }),
    sortValue: (f) => f.repoFullName ?? f.repo_full_name ?? '',
  },
  status: {
    label: 'Status',
    width: 10,
    render: (f) => ({
      text: f.status,
      color: f.status === 'open' ? 'red' : f.status === 'fixed' ? 'green' : 'gray',
    }),
    sortValue: (f) => f.status,
  },
  package: {
    label: 'Package',
    width: 20,
    render: (f) => ({ text: f.packageName ?? f.package_name ?? '', dim: true }),
    sortValue: (f) => f.packageName ?? f.package_name ?? '',
  },
  id: {
    label: 'ID',
    width: 36,
    render: (f) => ({ text: String(f.id ?? '-'), dim: true }),
    sortValue: (f) => String(f.id ?? ''),
  },
}

const ALL_COLUMN_NAMES = Object.keys(TUI_COLUMNS)
const DEFAULT_COLUMNS = ['severity', 'title', 'repo', 'status', 'package']

/* ------------------------------------------------------------------ */
/* Sort options                                                        */
/* ------------------------------------------------------------------ */

const SORT_OPTIONS = [
  { label: 'severity ↓', field: 'severity', dir: 'desc' as const },
  { label: 'severity ↑', field: 'severity', dir: 'asc' as const },
  { label: 'title ↑', field: 'title', dir: 'asc' as const },
  { label: 'title ↓', field: 'title', dir: 'desc' as const },
  { label: 'repo ↑', field: 'repo', dir: 'asc' as const },
  { label: 'repo ↓', field: 'repo', dir: 'desc' as const },
  { label: 'status ↑', field: 'status', dir: 'asc' as const },
  { label: 'status ↓', field: 'status', dir: 'desc' as const },
  { label: 'package ↑', field: 'package', dir: 'asc' as const },
  { label: 'package ↓', field: 'package', dir: 'desc' as const },
]

/* ================================================================== */
/* Component                                                           */
/* ================================================================== */

export function FindingsListView({
  token,
  filter,
  onFilterChange,
  onSelectFinding,
  onBack,
  focused,
}: FindingsListViewProps) {
  const { rows: terminalHeight } = useTermSize()
  const maxVisible = Math.max(3, terminalHeight - RESERVED_LINES)

  const [data, setData] = useState<SecurityFindingsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterMode, setFilterMode] = useState<FilterMode>('none')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [sortField, setSortField] = useState('severity')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMNS))
  const [repos, setRepos] = useState<SecurityAgentRepository[] | null>(null)
  const loadSeqRef = useRef(0)

  const loadRepos = async () => {
    try {
      setRepos(await getSecurityRepositories(token))
    } catch {
      setRepos([])
    }
  }

  const loadFindings = async () => {
    const seq = ++loadSeqRef.current
    setLoading(true)
    setError(null)
    try {
      // Severity sorts go through the API (global order across pages).
      // Other fields are sorted client-side — page-local only.
      const input =
        sortField === 'severity'
          ? { ...filter, sortBy: sortDir === 'asc' ? ('severity_asc' as const) : ('severity_desc' as const) }
          : filter
      const result = await listFindings(token, input)
      if (seq !== loadSeqRef.current) return // stale response, discard
      setData(result)
      setSelectedIdx(0)
      setScrollOffset(0)
    } catch (e) {
      if (seq !== loadSeqRef.current) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (seq === loadSeqRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    loadFindings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sortField, sortDir])

  // Adjust scroll offset when selection changes
  useEffect(() => {
    if (!data) return
    const findings = data.findings
    if (findings.length === 0) return

    if (selectedIdx < scrollOffset) {
      setScrollOffset(selectedIdx)
    } else if (selectedIdx >= scrollOffset + maxVisible) {
      setScrollOffset(selectedIdx - maxVisible + 1)
    }
  }, [selectedIdx, scrollOffset, maxVisible, data])

  useInput(
    (input, key) => {
      if (filterMode !== 'none') return
      if (key.escape) {
        onBack()
        return
      }
      if (input === 'f') {
        setFilterMode('severity')
        return
      }
      if (input === 's') {
        setFilterMode('status')
        return
      }
      if (input === 'o') {
        setFilterMode('sort')
        return
      }
      if (input === 'c') {
        setFilterMode('columns')
        return
      }
      if (input === 'r') {
        loadFindings()
        return
      }
      if (input === 'R') {
        setFilterMode('repo')
        loadRepos()
        return
      }
      if (
        input === 'n' &&
        data &&
        filter.offset + filter.limit < (data.totalCount ?? data.total_count ?? 0)
      ) {
        onFilterChange({ ...filter, offset: filter.offset + filter.limit })
        return
      }
      if (input === 'p' && filter.offset > 0) {
        onFilterChange({ ...filter, offset: Math.max(0, filter.offset - filter.limit) })
        return
      }

      if (!data || data.findings.length === 0) return

      if (key.upArrow) {
        setSelectedIdx((i) => Math.max(0, i - 1))
      }
      if (key.downArrow) {
        setSelectedIdx((i) => Math.min(data.findings.length - 1, i + 1))
      }
      if (key.return) {
        const sorted = sortFindings(data.findings, sortField, sortDir)
        const finding = sorted[selectedIdx]
        if (finding && finding.id) onSelectFinding(finding.id)
      }
    },
    { isActive: focused },
  )

  // --- Filter selection modes ---
  if (filterMode === 'repo') {
    if (repos === null) {
      return (
        <Box flexDirection="column">
          <Text color="yellow">Loading repositories…</Text>
          <FilterCancelHandler onBack={() => setFilterMode('none')} focused={focused} />
        </Box>
      )
    }
    const items = [
      { label: '(all repositories)', value: '' },
      ...repos.flatMap((r) => {
        const full = r.fullName ?? r.full_name
        if (!full) return []
        const count = r.findingsCount ?? r.findings_count
        return [{ label: count != null ? `${full} (${count})` : full, value: full }]
      }),
    ]
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          Filter by repository:
        </Text>
        <SelectInput
          items={items}
          isFocused={focused}
          onSelect={(item) => {
            onFilterChange({ ...filter, repoFullName: item.value || undefined, offset: 0 })
            setFilterMode('none')
          }}
        />
        <Text dimColor>Esc to cancel</Text>
        <FilterCancelHandler onBack={() => setFilterMode('none')} focused={focused} />
      </Box>
    )
  }

  if (filterMode === 'severity') {
    const items = [
      { label: '(all severities)', value: '' },
      { label: 'critical', value: 'critical' },
      { label: 'high', value: 'high' },
      { label: 'medium', value: 'medium' },
      { label: 'low', value: 'low' },
      { label: 'info', value: 'info' },
    ]
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          Filter by severity:
        </Text>
        <SelectInput
          items={items}
          isFocused={focused}
          onSelect={(item) => {
            onFilterChange({ ...filter, severity: item.value || undefined, offset: 0 })
            setFilterMode('none')
          }}
        />
        <Text dimColor>Esc to cancel</Text>
        <FilterCancelHandler onBack={() => setFilterMode('none')} focused={focused} />
      </Box>
    )
  }

  if (filterMode === 'status') {
    const items = [
      { label: '(all statuses)', value: '' },
      { label: 'open', value: 'open' },
      { label: 'dismissed', value: 'dismissed' },
      { label: 'remediated', value: 'remediated' },
      { label: 'in_progress', value: 'in_progress' },
    ]
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          Filter by status:
        </Text>
        <SelectInput
          items={items}
          isFocused={focused}
          onSelect={(item) => {
            onFilterChange({ ...filter, status: item.value || undefined, offset: 0 })
            setFilterMode('none')
          }}
        />
        <Text dimColor>Esc to cancel</Text>
        <FilterCancelHandler onBack={() => setFilterMode('none')} focused={focused} />
      </Box>
    )
  }

  if (filterMode === 'sort') {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          Sort by:
        </Text>
        <SelectInput
          items={SORT_OPTIONS.map((o) => ({
            label: `${o.label}${o.field === sortField && o.dir === sortDir ? ' (current)' : ''}`,
            value: `${o.field}:${o.dir}`,
          }))}
          isFocused={focused}
          onSelect={(item) => {
            const [field, dir] = item.value.split(':')
            setSortField(field)
            setSortDir(dir as 'asc' | 'desc')
            setFilterMode('none')
          }}
        />
        <Text dimColor>Esc to cancel</Text>
        <FilterCancelHandler onBack={() => setFilterMode('none')} focused={focused} />
      </Box>
    )
  }

  if (filterMode === 'columns') {
    return (
      <ColumnPicker
        allColumns={ALL_COLUMN_NAMES}
        visible={visibleColumns}
        onApply={(cols) => {
          setVisibleColumns(cols)
          setFilterMode('none')
        }}
        onCancel={() => setFilterMode('none')}
        focused={focused}
      />
    )
  }

  // --- Main findings list ---
  if (loading) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">Loading findings…</Text>
        <BackHandler onBack={onBack} focused={focused} />
      </Box>
    )
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <BackHandler onBack={onBack} focused={focused} />
      </Box>
    )
  }

  if (!data || data.findings.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No findings found.</Text>
        <Text dimColor>
          {filter.repoFullName
            ? `repo=${filter.repoFullName} — try R to pick another repository`
            : 'Press R to filter by repository, r to refresh, Esc to go back'}
        </Text>
        <BackHandler onBack={onBack} focused={focused} />
      </Box>
    )
  }

  const sorted = sortFindings(data.findings, sortField, sortDir)
  const total = data.totalCount ?? data.total_count ?? data.findings.length
  const running = data.runningCount ?? data.running_count ?? 0
  const concurrency = data.concurrencyLimit ?? data.concurrency_limit ?? '?'

  const columnList = ALL_COLUMN_NAMES.filter((c) => visibleColumns.has(c))

  // Calculate visible slice
  const visibleFindings = sorted.slice(scrollOffset, scrollOffset + maxVisible)
  const hasMoreAbove = scrollOffset > 0
  const hasMoreBelow = scrollOffset + maxVisible < sorted.length

  return (
    <Box flexDirection="column">
      {/* Summary bar */}
      <Box marginBottom={1}>
        <Text>
          <Text bold>Total: {total}</Text>
          <Text dimColor>
            {' '}
            | Running: {running} | Concurrency: {concurrency} | Sort: {sortField}
            {sortDir === 'desc' ? '↓' : '↑'}
            {sortField !== 'severity' ? ' (page)' : ''}
          </Text>
        </Text>
      </Box>

      {/* Active filters */}
      <Box marginBottom={1}>
        <Text dimColor>
          Filters:{' '}
          {filter.repoFullName ? <Text color="cyan">repo={filter.repoFullName}</Text> : null}
          {filter.repoFullName ? '  ' : ''}
          {filter.severity ? (
            <Text color={SEVERITY_COLORS[filter.severity] ?? 'white'}>
              severity={filter.severity}
            </Text>
          ) : (
            <Text>severity=all</Text>
          )}
          {'  '}
          {filter.status ? (
            <Text color="green">status={filter.status}</Text>
          ) : (
            <Text>status=all</Text>
          )}
          {'  '}
          <Text>page {filter.limit > 0 ? Math.floor(filter.offset / filter.limit) + 1 : 1}</Text>
        </Text>
      </Box>

      {/* Column header */}
      <Box>
        <Text>{'  '}</Text>
        {columnList.map((col) => (
          <React.Fragment key={col}>
            <Text bold dimColor>
              {TUI_COLUMNS[col].label.padEnd(TUI_COLUMNS[col].width).slice(0, TUI_COLUMNS[col].width)}
            </Text>
            <Text> </Text>
          </React.Fragment>
        ))}
      </Box>

      {/* Scroll indicator above */}
      {hasMoreAbove ? <Text dimColor> ↑ {scrollOffset} more above</Text> : null}

      {/* Findings list — only visible slice */}
      <Box flexDirection="column">
        {visibleFindings.map((f, i) => {
          const idx = scrollOffset + i
          return (
            <FindingRow
              key={f.id}
              finding={f}
              selected={idx === selectedIdx}
              columns={columnList}
            />
          )
        })}
      </Box>

      {/* Scroll indicator below */}
      {hasMoreBelow ? (
        <Text dimColor> ↓ {sorted.length - scrollOffset - maxVisible} more below</Text>
      ) : null}

      {/* Position indicator */}
      <Box marginTop={1}>
        <Text dimColor>
          [{selectedIdx + 1}/{sorted.length}] ↑↓ navigate Enter=details R=repo f=severity s=status
          o=sort c=columns n/p=page r=refresh Esc=back
        </Text>
      </Box>

      <BackHandler onBack={onBack} focused={focused} />
    </Box>
  )
}

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */

function sortFindings(
  findings: SecurityFinding[],
  field: string,
  dir: 'asc' | 'desc',
): SecurityFinding[] {
  const col = TUI_COLUMNS[field]
  if (!col) return findings
  return [...findings].sort((a, b) => {
    const av = col.sortValue(a)
    const bv = col.sortValue(b)
    const cmp =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
    return dir === 'desc' ? -cmp : cmp
  })
}

/* ================================================================== */
/* Sub-components                                                      */
/* ================================================================== */

function FindingRow({
  finding,
  selected,
  columns,
}: {
  finding: SecurityFinding
  selected: boolean
  columns: string[]
}) {
  return (
    <Box>
      <Text color={selected ? 'cyan' : undefined}>{selected ? '>' : ' '}</Text>
      <Text> </Text>
      {columns.map((col) => {
        const def = TUI_COLUMNS[col]
        const cell = def.render(finding)
        const truncated =
          cell.text.length > def.width ? `${cell.text.slice(0, def.width - 1)}…` : cell.text
        return (
          <React.Fragment key={col}>
            <Text color={cell.color} bold={cell.bold} dimColor={cell.dim}>
              {truncated.padEnd(def.width).slice(0, def.width)}
            </Text>
            <Text> </Text>
          </React.Fragment>
        )
      })}
    </Box>
  )
}

function ColumnPicker({
  allColumns,
  visible,
  onApply,
  onCancel,
  focused,
}: {
  allColumns: string[]
  visible: Set<string>
  onApply: (cols: Set<string>) => void
  onCancel: () => void
  focused: boolean
}) {
  const [cursor, setCursor] = useState(0)
  const [checked, setChecked] = useState(new Set(visible))

  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel()
        return
      }
      if (key.return) {
        onApply(checked)
        return
      }
      if (key.upArrow) setCursor((i) => Math.max(0, i - 1))
      if (key.downArrow) setCursor((i) => Math.min(allColumns.length - 1, i + 1))
      if (input === ' ') {
        const col = allColumns[cursor]
        setChecked((prev) => {
          const next = new Set(prev)
          if (next.has(col)) next.delete(col)
          else next.add(col)
          return next
        })
      }
    },
    { isActive: focused },
  )

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Columns:
      </Text>
      {allColumns.map((col, i) => (
        <Text key={col} color={i === cursor ? 'cyan' : undefined}>
          {i === cursor ? '>' : ' '} [{checked.has(col) ? 'x' : ' '}] {col}
        </Text>
      ))}
      <Text dimColor>Space=toggle Enter=apply Esc=cancel</Text>
    </Box>
  )
}

/** Handler that listens for Esc to go back. */
function BackHandler({ onBack, focused }: { onBack: () => void; focused: boolean }) {
  useInput(
    (_input, key) => {
      if (key.escape) onBack()
    },
    { isActive: focused },
  )
  return null
}

/** Handler for filter cancel. */
function FilterCancelHandler({ onBack, focused }: { onBack: () => void; focused: boolean }) {
  useInput(
    (_input, key) => {
      if (key.escape) onBack()
    },
    { isActive: focused },
  )
  return null
}
