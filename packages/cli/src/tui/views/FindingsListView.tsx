import React, { useEffect, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import SelectInput from 'ink-select-input'

import { listFindings } from '../../api/security-agent.ts'
import type { SecurityFinding, SecurityFindingsResult } from '../../api/types.ts'
import type { FindingsFilter } from '../types.ts'
import { SEVERITY_COLORS, STATUS_COLORS, ANALYSIS_COLORS, truncate } from '../../commands/theme.ts'

export interface FindingsListViewProps {
  token: string
  filter: FindingsFilter
  onFilterChange: (f: FindingsFilter) => void
  onSelectFinding: (id: string) => void
  onBack: () => void
}

type FilterMode = 'none' | 'severity' | 'status'

/** Lines reserved for header, filters, help bar, etc. */
const RESERVED_LINES = 8

export function FindingsListView({ token, filter, onFilterChange, onSelectFinding, onBack }: FindingsListViewProps) {
  const { stdout } = useStdout()
  const terminalHeight = stdout?.rows ?? 24
  const maxVisible = Math.max(3, terminalHeight - RESERVED_LINES)

  const [data, setData] = useState<SecurityFindingsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterMode, setFilterMode] = useState<FilterMode>('none')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)

  const loadFindings = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listFindings(token, filter)
      setData(result)
      setSelectedIdx(0)
      setScrollOffset(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFindings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

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

  useInput((input, key) => {
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
    if (input === 'r') {
      loadFindings()
      return
    }
    if (input === 'n' && data && filter.offset + filter.limit < (data.totalCount ?? 0)) {
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
      const finding = data.findings[selectedIdx]
      if (finding) onSelectFinding(finding.id)
    }
  })

  // --- Filter selection mode ---
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
        <Text bold color="cyan">Filter by severity:</Text>
        <SelectInput
          items={items}
          onSelect={(item) => {
            onFilterChange({ ...filter, severity: item.value || undefined, offset: 0 })
            setFilterMode('none')
          }}
        />
        <Text dimColor>Esc to cancel</Text>
        <FilterCancelHandler onBack={() => setFilterMode('none')} />
      </Box>
    )
  }

  if (filterMode === 'status') {
    const items = [
      { label: '(all statuses)', value: '' },
      { label: 'open', value: 'open' },
      { label: 'ignored', value: 'ignored' },
      { label: 'fixed', value: 'fixed' },
    ]
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">Filter by status:</Text>
        <SelectInput
          items={items}
          onSelect={(item) => {
            onFilterChange({ ...filter, status: item.value || undefined, offset: 0 })
            setFilterMode('none')
          }}
        />
        <Text dimColor>Esc to cancel</Text>
        <FilterCancelHandler onBack={() => setFilterMode('none')} />
      </Box>
    )
  }

  // --- Main findings list ---
  if (loading) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">Loading findings…</Text>
        <BackHandler onBack={onBack} />
      </Box>
    )
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <BackHandler onBack={onBack} />
      </Box>
    )
  }

  if (!data || data.findings.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No findings found.</Text>
        <BackHandler onBack={onBack} />
      </Box>
    )
  }

  const findings = data.findings
  const total = data.totalCount ?? data.total_count ?? findings.length
  const running = data.runningCount ?? data.running_count ?? 0
  const concurrency = data.concurrencyLimit ?? data.concurrency_limit ?? '?'

  // Calculate visible slice
  const visibleFindings = findings.slice(scrollOffset, scrollOffset + maxVisible)
  const hasMoreAbove = scrollOffset > 0
  const hasMoreBelow = scrollOffset + maxVisible < findings.length

  return (
    <Box flexDirection="column">
      {/* Summary bar */}
      <Box marginBottom={1}>
        <Text>
          <Text bold>Total: {total}</Text>
          <Text dimColor>  |  Running: {running}  |  Concurrency: {concurrency}</Text>
        </Text>
      </Box>

      {/* Active filters */}
      <Box marginBottom={1}>
        <Text dimColor>
          Filters: {' '}
          {filter.severity ? <Text color={SEVERITY_COLORS[filter.severity] ?? 'white'}>severity={filter.severity}</Text> : <Text>severity=all</Text>}
          {'  '}
          {filter.status ? <Text color={STATUS_COLORS[filter.status] ?? 'white'}>status={filter.status}</Text> : <Text>status=all</Text>}
          {'  '}
          <Text>page {Math.floor(filter.offset / filter.limit) + 1}</Text>
        </Text>
      </Box>

      {/* Scroll indicator above */}
      {hasMoreAbove ? <Text dimColor>  ^ {scrollOffset} more above</Text> : null}

      {/* Findings list — only visible slice */}
      <Box flexDirection="column">
        {visibleFindings.map((f, i) => {
          const idx = scrollOffset + i
          return (
            <FindingRow
              key={f.id}
              finding={f}
              selected={idx === selectedIdx}
            />
          )
        })}
      </Box>

      {/* Scroll indicator below */}
      {hasMoreBelow ? <Text dimColor>  v {findings.length - scrollOffset - maxVisible} more below</Text> : null}

      {/* Position indicator */}
      <Box marginTop={1}>
        <Text dimColor>
          [{selectedIdx + 1}/{findings.length}]  Up/Down navigate  Enter=details  f=severity  s=status  n=next page  p=prev  r=refresh  Esc=back
        </Text>
      </Box>

      <BackHandler onBack={onBack} />
    </Box>
  )
}

function FindingRow({ finding, selected }: { finding: SecurityFinding; selected: boolean }) {
  const sev = finding.severity
  const sevColor = SEVERITY_COLORS[sev] ?? 'white'
  const repo = finding.repoFullName ?? finding.repo_full_name ?? '-'
  const title = truncate(finding.title, 50)
  const statusColor = STATUS_COLORS[finding.status] ?? 'white'
  const analysis = finding.analysisStatus ?? finding.analysis_status ?? '-'
  const analysisColor = ANALYSIS_COLORS[analysis] ?? 'gray'

  return (
    <Box>
      <Text color={selected ? 'cyan' : undefined}>{selected ? '>' : ' '}</Text>
      <Text> </Text>
      <Text color={sevColor} bold>{sev.padEnd(8)}</Text>
      <Text> </Text>
      <Text>{title.padEnd(50).slice(0, 50)}</Text>
      <Text> </Text>
      <Text dimColor>{repo.slice(0, 30).padEnd(30)}</Text>
      <Text> </Text>
      <Text color={statusColor}>{finding.status.slice(0, 8).padEnd(8)}</Text>
      <Text> </Text>
      <Text color={analysisColor}>{analysis.slice(0, 10).padEnd(10)}</Text>
    </Box>
  )
}

/** Handler that listens for Esc to go back. */
function BackHandler({ onBack }: { onBack: () => void }) {
  useInput((_input, key) => {
    if (key.escape) onBack()
  })
  return null
}

/** Handler for filter cancel. */
function FilterCancelHandler({ onBack }: { onBack: () => void }) {
  useInput((_input, key) => {
    if (key.escape) onBack()
  })
  return null
}
