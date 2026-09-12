import React, { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'

import { getDashboardStats } from '../../api/security-agent.ts'

export interface DashboardViewProps {
  token: string
  onBack: () => void
  focused: boolean
}

export function DashboardView({ token, onBack, focused }: DashboardViewProps) {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const s = await getDashboardStats(token)
        setStats(s)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  useInput((_input, key) => {
    if (key.escape) onBack()
  }, { isActive: focused })

  if (loading) {
    return <Box><Text color="yellow">Loading dashboard…</Text></Box>
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Esc to go back</Text>
      </Box>
    )
  }

  if (!stats) return null

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}><Text bold color="cyan">Security Dashboard</Text></Box>

      {Object.entries(stats).map(([key, value]) => (
        <DashboardSection key={key} title={key} value={value} />
      ))}

      <Box marginTop={1}><Text dimColor>Esc to go back</Text></Box>
    </Box>
  )
}

function DashboardSection({ title, value }: { title: string; value: unknown }) {
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
    const rows = value as Record<string, unknown>[]
    const cols = Object.keys(rows[0]).slice(0, 6)
    return (
      <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="blue" paddingX={1}>
        <Text bold color="blue">{title} ({rows.length})</Text>
        <Box marginTop={1}>
          {cols.map((c) => (
            <Box key={c} width={18}><Text bold dimColor>{c}</Text></Box>
          ))}
        </Box>
        {rows.slice(0, 15).map((row, i) => (
          <Box key={i}>
            {cols.map((c) => (
              <Box key={c} width={18}><Text>{String(row[c] ?? '-').slice(0, 17)}</Text></Box>
            ))}
          </Box>
        ))}
        {rows.length > 15 ? <Text dimColor>... and {rows.length - 15} more</Text> : null}
      </Box>
    )
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return (
      <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="magenta" paddingX={1}>
        <Text bold color="magenta">{title}</Text>
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <Box key={k}>
            <Box width={20}><Text dimColor>{k}:</Text></Box>
            <Text>{String(v)}</Text>
          </Box>
        ))}
      </Box>
    )
  }

  return (
    <Box marginBottom={1}>
      <Box width={24}><Text dimColor>{title}:</Text></Box>
      <Text>{String(value)}</Text>
    </Box>
  )
}
