import { Box, Text, useInput } from 'ink'
import React, { useEffect, useState } from 'react'

import {
  commandFailureDetail,
  commandOutcome,
  DISMISS_REASONS,
  type DismissReason,
  dismissFinding,
  getFinding,
  startRemediation,
  waitForCommand,
} from '../../api/security-agent.ts'
import type {
  RemediationCapability as RemediationCapabilityType,
  RemediationSummary as RemediationSummaryType,
  SecurityFinding,
} from '../../api/types.ts'

/** Inline result banner shown after a mutation. */
interface Notice {
  text: string
  error: boolean
}

export interface FindingDetailViewProps {
  readonly token: string
  readonly findingId: string
  readonly onBack: () => void
  readonly focused: boolean
}

/** Status → colour for a finding. */
const FINDING_STATUS_COLORS: Record<string, string> = {
  open: 'red',
  fixed: 'green',
}

const ACTION_KEYS: Record<string, 'dismiss' | 'remediate' | undefined> = {
  d: 'dismiss',
  r: 'remediate',
}

const ANALYSIS_COLORS: Record<string, string> = {
  completed: 'green',
  failed: 'red',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'yellow',
  medium: 'blue',
  low: 'gray',
  info: 'gray',
}

/** The header of the finding detail. */
function FindingHeader({ finding }: Readonly<{ finding: SecurityFinding }>) {
  const sev = finding.severity
  const color = SEVERITY_COLORS[sev] ?? 'white'
  return (
    <Box marginBottom={1}>
      <Text bold color={color}>
        {sev.toUpperCase()}
      </Text>
      <Text> </Text>
      <Text bold>{finding.title}</Text>
    </Box>
  )
}

/** The identity of the finding. */
function BasicInfo({ finding }: Readonly<{ finding: SecurityFinding }>) {
  const repo = finding.repoFullName ?? finding.repo_full_name ?? '-'
  const statusColor = FINDING_STATUS_COLORS[finding.status] ?? 'gray'
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Field label="ID" value={finding.id} />
      <Field label="Repository" value={repo} />
      <Field label="Status" value={finding.status} color={statusColor} />
      {finding.source ? <Field label="Source" value={finding.source} /> : null}
      {finding.description ? <Field label="Description" value={finding.description} /> : null}
    </Box>
  )
}

/** The package the finding is about. */
function PackageSection({ finding }: Readonly<{ finding: SecurityFinding }>) {
  const pkg = finding.packageName ?? finding.package_name
  if (!pkg) return null
  const ecosystem = finding.packageEcosystem ?? finding.package_ecosystem
  const vuln = finding.vulnerableVersionRange ?? finding.vulnerable_version_range
  const patched = finding.patchedVersion ?? finding.patched_version
  const cve = finding.cveId ?? finding.cve_id
  const ghsa = finding.ghsaId ?? finding.ghsa_id
  const cvss = finding.cvssScore ?? finding.cvss_score
  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
    >
      <Text bold color="cyan">
        Package
      </Text>
      <Field label="Name" value={pkg} />
      {ecosystem ? <Field label="Ecosystem" value={ecosystem} /> : null}
      {vuln ? <Field label="Vulnerable" value={vuln} color="red" /> : null}
      {patched ? <Field label="Patched" value={patched} color="green" /> : null}
      {cve ? <Field label="CVE" value={cve} /> : null}
      {ghsa ? <Field label="GHSA" value={ghsa} /> : null}
      {cvss !== undefined ? <Field label="CVSS" value={String(cvss)} /> : null}
    </Box>
  )
}

/** The SLA deadline of the finding. */
function SlaSection({ finding }: Readonly<{ finding: SecurityFinding }>) {
  const sla = finding.slaDueAt ?? finding.sla_due_at
  if (!sla) return null
  return (
    <Box marginBottom={1}>
      <Text bold color="yellow">
        ! SLA due:{' '}
      </Text>
      <Text>{sla}</Text>
    </Box>
  )
}

/** The last analysis run of the finding. */
function AnalysisSection({ finding }: Readonly<{ finding: SecurityFinding }>) {
  const analysisStatus = finding.analysisStatus ?? finding.analysis_status
  const analysisError = finding.analysisError ?? finding.analysis_error
  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="single"
      borderColor="magenta"
      paddingX={1}
    >
      <Text bold color="magenta">
        Analysis
      </Text>
      {analysisStatus ? (
        <Field
          label="Status"
          value={analysisStatus}
          color={ANALYSIS_COLORS[analysisStatus] ?? 'yellow'}
        />
      ) : (
        <Text dimColor>No analysis run yet</Text>
      )}
      {analysisError ? <Field label="Error" value={analysisError} color="red" /> : null}
    </Box>
  )
}

/** The remediation of the finding: a summary, the details, or nothing yet. */
function remediationBody(
  remediation: string | RemediationSummaryType | null | undefined,
): React.ReactNode {
  if (typeof remediation === 'string') return <Field label="Summary" value={remediation} />
  if (remediation) return <RemediationSummary summary={remediation} />
  return <Text dimColor>No remediation yet</Text>
}

/** What has been done about the finding — and what may be done. */
function RemediationSection({ finding }: Readonly<{ finding: SecurityFinding }>) {
  const remediation = finding.remediationSummary ?? finding.remediation_summary
  const remediationCap = finding.remediationCapability ?? finding.remediation_capability
  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="single"
      borderColor="green"
      paddingX={1}
    >
      <Text bold color="green">
        Remediation
      </Text>
      {remediationBody(remediation)}
      {remediationCap ? <RemediationCapability cap={remediationCap} /> : null}
    </Box>
  )
}

/** When the finding appeared and when it changed last. */
function TimestampsSection({ finding }: Readonly<{ finding: SecurityFinding }>) {
  const created = finding.createdAt ?? finding.created_at
  const updated = finding.updatedAt ?? finding.updated_at
  return (
    <Box flexDirection="column" marginTop={1}>
      {created ? <Field label="Created" value={created} dim /> : null}
      {updated ? <Field label="Updated" value={updated} dim /> : null}
    </Box>
  )
}

/** The result of the last action. */
function NoticeBanner({ notice }: Readonly<{ notice: Notice }>) {
  return (
    <Box marginTop={1}>
      <Text color={notice.error ? 'red' : 'green'}>{notice.text}</Text>
    </Box>
  )
}

/** The confirmation prompt of a pending action. */
function ConfirmPrompt({
  confirm,
  dismissReason,
}: Readonly<{ confirm: 'dismiss' | 'remediate'; dismissReason: DismissReason }>) {
  const isDismiss = confirm === 'dismiss'
  return (
    <Box marginTop={1} flexDirection="column">
      <Text color="yellow">
        {isDismiss
          ? `Dismiss this finding — reason: ${dismissReason}`
          : 'Start remediation (may open a PR)'}{' '}
        — press {isDismiss ? 'd' : 'r'} again to confirm
      </Text>
      {isDismiss ? (
        <Text dimColor>reason: {DISMISS_REASONS.map((r, i) => `${i + 1}=${r}`).join('  ')}</Text>
      ) : null}
    </Box>
  )
}

export function FindingDetailView({ token, findingId, onBack, focused }: FindingDetailViewProps) {
  const [finding, setFinding] = useState<SecurityFinding | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [confirm, setConfirm] = useState<'dismiss' | 'remediate' | null>(null)
  const [dismissReason, setDismissReason] = useState<DismissReason>('tolerable_risk')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    let stale = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const f = await getFinding(token, findingId)
        if (!stale) setFinding(f)
      } catch (e) {
        if (!stale) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!stale) setLoading(false)
      }
    }
    void load()
    return () => {
      stale = true
    }
  }, [token, findingId, reloadKey])

  const dismiss = async (): Promise<Notice> => {
    const queued = await dismissFinding(token, findingId, dismissReason)
    if (!queued.accepted) {
      return { text: 'Dismissal was not accepted by the server', error: true }
    }
    if (!queued.commandId) {
      return { text: `Dismissal queued (${dismissReason})`, error: false }
    }
    const command = await waitForCommand(token, queued.commandId)
    const outcome = commandOutcome(command)
    if (outcome === 'failed') {
      const detail = commandFailureDetail(command)
      return { text: detail ? `Dismissal failed: ${detail}` : 'Dismissal failed', error: true }
    }
    if (outcome === 'pending') {
      const status = command.status ?? 'unknown'
      return { text: `Dismissal still ${status} (command ${queued.commandId})`, error: false }
    }
    return { text: `Finding dismissed (${dismissReason})`, error: false }
  }

  const remediate = async (): Promise<Notice> => {
    const { attemptId } = await startRemediation(token, findingId)
    return { text: `Remediation started (attempt ${attemptId})`, error: false }
  }

  const act = async (what: 'dismiss' | 'remediate') => {
    setBusy(true)
    try {
      setNotice(await (what === 'dismiss' ? dismiss() : remediate()))
      setReloadKey((k) => k + 1)
    } catch (e) {
      setNotice({
        text: `${what === 'dismiss' ? 'Dismiss' : 'Remediate'} failed: ${e instanceof Error ? e.message : String(e)}`,
        error: true,
      })
    } finally {
      setBusy(false)
    }
  }

  const blockedReason = (want: 'dismiss' | 'remediate'): string | null => {
    if (!finding) return null
    if (want === 'dismiss') {
      return finding.status === 'open' ? null : `finding is ${finding.status}`
    }
    const cap = finding.remediationCapability ?? finding.remediation_capability
    if (cap?.canStart === false) return cap.startReason ?? 'not allowed'
    return null
  }

  useInput(
    (input, key) => {
      if (key.escape) {
        if (confirm) setConfirm(null)
        else onBack()
        return
      }
      if (busy || loading || !finding) return
      // While armed for dismiss, digits pick the dismissal reason.
      if (confirm === 'dismiss') {
        const idx = Number(input) - 1
        if (idx >= 0 && idx < DISMISS_REASONS.length) {
          setDismissReason(DISMISS_REASONS[idx]!)
          return
        }
      }
      const want = ACTION_KEYS[input]
      if (!want) return
      if (confirm === want) {
        setConfirm(null)
        void act(want)
        return
      }
      const blocked = blockedReason(want)
      if (blocked) {
        setNotice({
          text: `Cannot ${want} — ${blocked}`,
          error: true,
        })
        return
      }
      setConfirm(want)
      setNotice(null)
    },
    { isActive: focused },
  )

  if (loading) {
    return (
      <Box>
        <Text color="yellow">Loading finding details…</Text>
        <Text dimColor>{'  (Esc to go back)'}</Text>
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

  return (
    <Box flexDirection="column">
      {/* Header */}
      <FindingHeader finding={finding} />

      {/* Basic info */}
      <BasicInfo finding={finding} />

      {/* Package info */}
      <PackageSection finding={finding} />

      {/* SLA */}
      <SlaSection finding={finding} />

      {/* Analysis section */}
      <AnalysisSection finding={finding} />

      {/* Remediation section */}
      <RemediationSection finding={finding} />

      {/* Timestamps */}
      <TimestampsSection finding={finding} />

      {notice ? <NoticeBanner notice={notice} /> : null}

      {confirm ? <ConfirmPrompt confirm={confirm} dismissReason={dismissReason} /> : null}

      <Box marginTop={1}>
        <Text dimColor>
          {finding.status === 'open' ? 'd=dismiss ' : ''}
          r=remediate Esc=back
        </Text>
      </Box>
    </Box>
  )
}

function Field({
  label,
  value,
  color,
  dim,
}: Readonly<{
  label: string
  value: string
  color?: string
  dim?: boolean
}>) {
  return (
    <Box>
      <Box width={14}>
        <Text dimColor>{label}:</Text>
      </Box>
      <Text color={color} dimColor={dim}>
        {value}
      </Text>
    </Box>
  )
}

function RemediationSummary({ summary }: Readonly<{ summary: RemediationSummaryType }>) {
  const attempt = summary.latestAttempt
  const prUrl = summary.prUrl ?? attempt?.prUrl
  return (
    <Box flexDirection="column">
      {summary.status ? (
        <Field
          label="Status"
          value={summary.status}
          color={summary.status === 'running' ? 'yellow' : undefined}
        />
      ) : null}
      {prUrl ? <Field label="PR" value={prUrl} color="cyan" /> : null}
      {attempt?.branchName ? <Field label="Branch" value={attempt.branchName} dim /> : null}
      {attempt?.status ? <Field label="Attempt" value={attempt.status} dim /> : null}
      {summary.outcomeSummary ? <Field label="Outcome" value={summary.outcomeSummary} /> : null}
    </Box>
  )
}

function RemediationCapability({ cap }: Readonly<{ cap: RemediationCapabilityType }>) {
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
          <Box width={14}>
            <Text dimColor>canStart:</Text>
          </Box>
          <Text color={canStart ? 'green' : 'gray'}>{String(canStart)}</Text>
          {startReason ? <Text dimColor> ({startReason})</Text> : null}
        </Box>
      ) : null}
      {canRetry !== undefined ? (
        <Box>
          <Box width={14}>
            <Text dimColor>canRetry:</Text>
          </Box>
          <Text color={canRetry ? 'green' : 'gray'}>{String(canRetry)}</Text>
          {retryReason ? <Text dimColor> ({retryReason})</Text> : null}
        </Box>
      ) : null}
      {canCancel !== undefined ? (
        <Box>
          <Box width={14}>
            <Text dimColor>canCancel:</Text>
          </Box>
          <Text color={canCancel ? 'green' : 'gray'}>{String(canCancel)}</Text>
          {cancelReason ? <Text dimColor> ({cancelReason})</Text> : null}
        </Box>
      ) : null}
    </Box>
  )
}
