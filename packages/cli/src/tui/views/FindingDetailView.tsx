import React, { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'

import { getFinding } from '../../api/security-agent.ts'
import type { SecurityFinding } from '../../api/types.ts'
import { SEVERITY_COLORS, STATUS_COLORS, ANALYSIS_COLORS } from '../../commands/theme.ts'

export interface FindingDetailViewProps {
  token: string
  findingId: string
  onBack: () => void
}

export function FindingDetailView({ token, findingId, onBack }: FindingDetailViewProps) {
  const [finding, setFinding] = useState<SecurityFinding | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const f = await getFinding(token, findingId)
        setFinding(f)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, findingId])

  useInput((_input, key) => {
    if (key.escape) onBack()
  })

  if (loading) {
    return (
      <Box>
        <Text color="yellow">Loading finding details…</Text>
        <Text dimColor>  (Esc to go back)</Text>
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

  if (!finding) return null

  const sev = finding.severity
  const sevColor = SEVERITY_COLORS[sev] ?? 'white'
  const repo = finding.repoFullName ?? finding.repo_full_name ?? '-'
  const repoShort = repo.split('/').pop() ?? repo
  const sla = finding.slaDueAt ?? finding.sla_due_at
  const analysisStatus = finding.analysisStatus ?? finding.analysis_status ?? '-'
  const analysisColor = ANALYSIS_COLORS[analysisStatus] ?? 'gray'
  const analysisError = finding.analysisError ?? finding.analysis_error
  const remediation = finding.remediationSummary ?? finding.remediation_summary
  const remediationCap = finding.remediationCapability ?? finding.remediation_capability
  const created = finding.createdAt ?? finding.created_at
  const updated = finding.updatedAt ?? finding.updated_at
  const statusColor = STATUS_COLORS[finding.status] ?? 'white'

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={sevColor}>{sev.toUpperCase()}</Text>
        <Text>  </Text>
        <Text bold>{finding.title}</Text>
      </Box>

      {/* Basic info */}
      <Box flexDirection="column" marginBottom={1}>
        <Field label="ID" value={finding.id} />
        <Field label="Repo" value={repoShort} />
        <Field label="Status" value={finding.status} color={statusColor} />
        {finding.source ? <Field label="Source" value={finding.source} /> : null}
        {finding.description ? <Field label="Description" value={finding.description} /> : null}
      </Box>

      {/* SLA deadline */}
      {sla ? (
        <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="yellow" paddingX={1}>
          <Text bold color="yellow">SLA Deadline</Text>
          <Field label="Due" value={sla} color="yellow" />
        </Box>
      ) : null}

      {/* Analysis section */}
      <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="magenta" paddingX={1}>
        <Text bold color="magenta">Analysis</Text>
        <Field label="Status" value={analysisStatus} color={analysisColor} />
        {analysisError ? <Field label="Error" value={analysisError} color="red" /> : null}
      </Box>

      {/* Remediation section */}
      <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="green" paddingX={1}>
        <Text bold color="green">Remediation</Text>
        {remediation ? (
          <Field label="Summary" value={remediation} />
        ) : (
          <Text dimColor>No remediation yet</Text>
        )}
        {remediationCap && typeof remediationCap === 'object' ? (
          <RemediationCapability cap={remediationCap as Record<string, unknown>} />
        ) : null}
      </Box>

      {/* Timestamps */}
      <Box flexDirection="column" marginTop={1}>
        {created ? <Field label="Created" value={created} dim /> : null}
        {updated ? <Field label="Updated" value={updated} dim /> : null}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Esc to go back to findings list</Text>
      </Box>
    </Box>
  )
}

function Field({ label, value, color, dim }: { label: string; value: string; color?: string; dim?: boolean }) {
  return (
    <Box>
      <Box width={14}><Text dimColor>{label}:</Text></Box>
      <Text color={color} dimColor={dim}>{value}</Text>
    </Box>
  )
}

function RemediationCapability({ cap }: { cap: Record<string, unknown> }) {
  const canStart = cap.canStart
  const startReason = cap.startReason
  const canRetry = cap.canRetry
  const retryReason = cap.retryReason
  const canCancel = cap.canCancel
  const cancelReason = cap.cancelReason

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>Capabilities:</Text>
      {canStart !== undefined ? (
        <Box>
          <Box width={14}><Text dimColor>canStart:</Text></Box>
          <Text color={canStart ? 'green' : 'gray'}>{String(canStart)}</Text>
          {startReason ? <Text dimColor> ({String(startReason)})</Text> : null}
        </Box>
      ) : null}
      {canRetry !== undefined ? (
        <Box>
          <Box width={14}><Text dimColor>canRetry:</Text></Box>
          <Text color={canRetry ? 'green' : 'gray'}>{String(canRetry)}</Text>
          {retryReason ? <Text dimColor> ({String(retryReason)})</Text> : null}
        </Box>
      ) : null}
      {canCancel !== undefined ? (
        <Box>
          <Box width={14}><Text dimColor>canCancel:</Text></Box>
          <Text color={canCancel ? 'green' : 'gray'}>{String(canCancel)}</Text>
          {cancelReason ? <Text dimColor> ({String(cancelReason)})</Text> : null}
        </Box>
      ) : null}
    </Box>
  )
}
