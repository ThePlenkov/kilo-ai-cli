import React, { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import SelectInput from 'ink-select-input'

import { listFindings } from '../../api/security-agent.ts'
import type { SecurityFinding, SecurityFindingsResult } from '../../api/types.ts'
import type { FindingsFilter } from '../types.ts'

export interface FindingsListViewProps {
  token: string
  filter: FindingsFilter
  onFilterChange: (f: FindingsFilter) => void
  onSelectFinding: (id: string) => void
  onBack: () => void
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'yellow',
  medium: 'blue',
  low: 'gray',
  info: 'gray',
}

type FilterMode = 'none' | 'severity' | 'status'

export function FindingsListView({ token, filter, onFilterChange, onSelectFinding, onBack }: FindingsListViewProps) {
  const [data, setData] = useState<SecurityFindingsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterMode, setFilterMode] = useState<FilterMode>('none')
  const [selectedIdx, setSelectedIdx] = useState(0)

  const loadFindings = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listFindings(token, filter)
      setData(result)
      setSelectedIdx(0)
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
          {filter.status ? <Text color="green">status={filter.status}</Text> : <Text>status=all</Text>}
          {'  '}
          <Text>page {Math.floor(filter.offset / filter.limit) + 1}</Text>
        </Text>
      </Box>

      {/* Findings list */}
      <Box flexDirection="column">
        {findings.map((f, i) => (
          <FindingRow
            key={f.id}
            finding={f}
            selected={i === selectedIdx}
          />
        ))}
      </Box>

      {/* Help bar */}
      <Box marginTop={1}>
        <Text dimColor>
          Up/Down navigate  Enter=details  f=filter severity  s=filter status  n=next page  p=prev page  r=refresh  Esc=back
        </Text>
      </Box>

      <BackHandler onBack={onBack} />
    </Box>
  )
}

function FindingRow({ finding, selected }: { finding: SecurityFinding; selected: boolean }) {
  const sev = finding.severity
  const color = SEVERITY_COLORS[sev] ?? 'white'
  const repo = finding.repoFullName ?? finding.repo_full_name ?? '-'
  const pkg = finding.packageName ?? finding.package_name ?? ''
  const title = finding.title.length > 55 ? finding.title.slice(0, 54) + '…' : finding.title
  const statusColor = finding.status === 'open' ? 'red' : finding.status === 'fixed' ? 'green' : 'gray'

  return (
    <Box>
      <Text color={selected ? 'cyan' : undefined}>{selected ? '>' : ' '}</Text>
      <Text> </Text>
      <Text color={color} bold>{sev.padEnd(8)}</Text>
      <Text> </Text>
      <Text>{title.padEnd(55).slice(0, 55)}</Text>
      <Text> </Text>
      <Text dimColor>{repo.slice(0, 28).padEnd(28)}</Text>
      <Text> </Text>
      <Text color={statusColor}>{finding.status.slice(0, 8).padEnd(8)}</Text>
      {pkg ? <Text dimColor> {pkg}</Text> : null}
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
