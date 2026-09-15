import { Box, Text, useInput } from 'ink'
import React, { useEffect, useState } from 'react'

import { getSecurityStats } from '../../api/security-agent.ts'

export interface StatsViewProps {
  token: string
  onBack: () => void
  focused: boolean
}

export function StatsView({ token, onBack, focused }: StatsViewProps) {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const s = await getSecurityStats(token)
        setStats(s)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  useInput(
    (_input, key) => {
      if (key.escape) onBack()
    },
    { isActive: focused },
  )

  if (loading) {
    return (
      <Box>
        <Text color="yellow">Loading stats…</Text>
      </Box>
    )
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

  const entries = Object.entries(stats)
  const total = stats.total ?? stats.totalFindings
  const critical = stats.critical ?? stats.criticalFindings
  const high = stats.high ?? stats.highFindings
  const medium = stats.medium ?? stats.mediumFindings
  const low = stats.low ?? stats.lowFindings
  const open = stats.open ?? stats.openFindings
  const fixed = stats.fixed ?? stats.fixedFindings ?? stats.remediatedFindings
  const ignored = stats.ignored ?? stats.ignoredFindings ?? stats.dismissedFindings

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Security Statistics
        </Text>
      </Box>

      {/* Severity breakdown */}
      <Box
        flexDirection="column"
        marginBottom={1}
        borderStyle="single"
        borderColor="red"
        paddingX={1}
      >
        <Text bold color="red">
          By Severity
        </Text>
        <StatBar
          label="Critical"
          value={Number(critical) || 0}
          total={Number(total) || 0}
          color="red"
        />
        <StatBar label="High" value={Number(high) || 0} total={Number(total) || 0} color="yellow" />
        <StatBar
          label="Medium"
          value={Number(medium) || 0}
          total={Number(total) || 0}
          color="blue"
        />
        <StatBar label="Low" value={Number(low) || 0} total={Number(total) || 0} color="gray" />
      </Box>

      {/* Status breakdown */}
      <Box
        flexDirection="column"
        marginBottom={1}
        borderStyle="single"
        borderColor="green"
        paddingX={1}
      >
        <Text bold color="green">
          By Status
        </Text>
        <StatBar label="Open" value={Number(open) || 0} total={Number(total) || 0} color="red" />
        <StatBar
          label="Fixed"
          value={Number(fixed) || 0}
          total={Number(total) || 0}
          color="green"
        />
        <StatBar
          label="Ignored"
          value={Number(ignored) || 0}
          total={Number(total) || 0}
          color="gray"
        />
      </Box>

      {/* Raw values */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold dimColor>
          All values:
        </Text>
        {entries.map(([k, v]) => (
          <Box key={k}>
            <Box width={20}>
              <Text dimColor>{k}:</Text>
            </Box>
            <Text>{String(v)}</Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Esc to go back</Text>
      </Box>
    </Box>
  )
}

function StatBar({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const barLen = Math.round(pct / 5)
  const bar = '#'.repeat(barLen) + '-'.repeat(20 - barLen)
  return (
    <Box>
      <Box width={10}>
        <Text>{label}</Text>
      </Box>
      <Text color={color}>{bar}</Text>
      <Text> {value}</Text>
      <Text dimColor> ({pct}%)</Text>
    </Box>
  )
}
