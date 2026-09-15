import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import React, { useState } from 'react'

import {
  getCodeReview,
  getOrgReviewAgentConfig,
  getPersonalReviewConfig,
  listCodeReviews,
  listCodeReviewsForUser,
  saveOrgReviewConfig,
  savePersonalReviewConfig,
  togglePersonalReviewAgent,
  toggleReviewAgent,
  toSaveReviewConfigInput,
} from '../../api/code-reviews.ts'
import type { CodeReview } from '../../api/types.ts'
import type { Column } from '../components.tsx'
import { clean, DataTable, QueryListScreen, RecordView } from '../components.tsx'
import { useQuery, useTermSize } from '../hooks.ts'
import type { ScreenProps } from '../types.ts'

const STATUS_COLORS: Record<string, string> = {
  completed: 'green',
  failed: 'red',
  running: 'yellow',
  pending: 'yellow',
}

/** Cloud → Code Reviewer: personal reviews, or org reviews when org context is set. */
export function ReviewsScreen({ ctx, focused }: ScreenProps) {
  const { columns: termColumns } = useTermSize()
  // Sidebar (26) + padding eats ~32 cols; size the table to the content pane.
  const avail = Math.max(40, termColumns - 34)
  const narrow = avail < 70
  const titleWidth = narrow ? avail - 22 : avail - 52

  const columns: Column<CodeReview>[] = [
    { label: 'Title', width: Math.max(12, titleWidth), value: (r) => r.pr_title ?? '-' },
    {
      label: 'Status',
      width: 10,
      value: (r) => r.status,
      color: (r) => STATUS_COLORS[r.status],
    },
  ]
  if (!narrow) columns.push({ label: 'Repo', width: 24, value: (r) => r.repo_full_name ?? '-' })
  columns.push({ label: 'PR', width: 6, align: 'right', value: (r) => String(r.pr_number ?? '-') })

  return (
    <QueryListScreen<CodeReview>
      focused={focused}
      fetch={() =>
        ctx.organizationId
          ? listCodeReviews(ctx.token, ctx.organizationId)
          : listCodeReviewsForUser(ctx.token)
      }
      columns={columns}
      banner={() => <Text dimColor>{ctx.organizationId ? 'org reviews' : 'personal reviews'}</Text>}
      onSelect={(r) => ctx.navigate('review-detail', { id: r.id })}
      onBack={ctx.goBack}
      emptyText="No code reviews."
    />
  )
}

/** Cloud → review detail: review record + attempts table. */
export function ReviewDetailScreen({ ctx, focused }: ScreenProps) {
  const { columns: termColumns, rows: termRows } = useTermSize()
  // Record view ~15 rows + attempts header/legend + footer → cap attempt rows.
  const maxAttempts = Math.max(2, termRows - 22)
  // The declared attempts table needs ~95 cols; below that DataTable would
  // shrink the error column into unreadability — drop the timestamps first.
  const avail = Math.max(30, termColumns - 34)
  const narrowAttempts = avail < 95
  const id = ctx.route.params.id ?? ''
  const { data, error, loading, reload } = useQuery(
    () => getCodeReview(ctx.token, id),
    [ctx.token, id],
  )

  useInput(
    (input, key) => {
      if (key.escape) ctx.goBack()
      if (input === 'r') reload()
    },
    { isActive: focused },
  )

  if (loading && !data) return <Text color="yellow">Loading review…</Text>
  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>r=retry Esc=back</Text>
      </Box>
    )
  }
  if (!data) return null

  const { review, attempts, tokenUsage } = data
  return (
    <Box flexDirection="column">
      <RecordView
        data={{
          id: review.id,
          title: review.pr_title ?? '-',
          status: review.status,
          repo: review.repo_full_name ?? '-',
          pr: review.pr_number != null ? `#${review.pr_number}` : '-',
          url: review.pr_url ?? '-',
          author: review.pr_author ?? '-',
          model: review.model ?? '-',
          trigger: review.trigger_source ?? '-',
          type: review.review_type ?? '-',
          started: review.started_at ?? '-',
          completed: review.completed_at ?? '-',
          error: review.error_message ?? undefined,
          tokens: tokenUsage
            ? `in ${tokenUsage.input} / out ${tokenUsage.output} / cached ${tokenUsage.cached}`
            : '-',
        }}
      />
      {attempts.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Attempts ({attempts.length})</Text>
          <DataTable
            // Cap rows so the table + record fit the height-clamped pane.
            rows={attempts.slice(0, maxAttempts)}
            columns={[
              { label: '#', width: 3, align: 'right', value: (a) => String(a.attempt_number) },
              {
                label: 'Status',
                width: 12,
                value: (a) => a.status,
                color: (a) => STATUS_COLORS[a.status],
              },
              ...(narrowAttempts
                ? []
                : [
                    {
                      label: 'Started',
                      width: 20,
                      value: (a: (typeof attempts)[number]) => a.started_at ?? '-',
                    },
                    {
                      label: 'Completed',
                      width: 20,
                      value: (a: (typeof attempts)[number]) => a.completed_at ?? '-',
                    },
                  ]),
              {
                label: 'Error',
                width: narrowAttempts ? avail - 19 : 30,
                value: (a) => a.error_message ?? '-',
              },
            ]}
          />
          {attempts.length > maxAttempts ? (
            <Text dimColor> … {attempts.length - maxAttempts} more attempts</Text>
          ) : null}
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>r=refresh Esc=back</Text>
      </Box>
    </Box>
  )
}

const PLATFORMS = ['github', 'gitlab'] as const
type Platform = (typeof PLATFORMS)[number]

/** Cloud → Review Agent: view config, toggle enabled, set model. */
export function ReviewAgentScreen({ ctx, focused }: ScreenProps) {
  const [platform, setPlatform] = useState<Platform>('github')
  const [editing, setEditing] = useState(false)
  const [model, setModel] = useState('')
  const [confirmToggle, setConfirmToggle] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const [useOrg, setUseOrg] = useState(true)
  const orgId = ctx.organizationId
  const effOrg = useOrg ? orgId : undefined

  const {
    data: result,
    error,
    loading,
    reload,
  } = useQuery(
    async () => ({
      platform,
      org: effOrg,
      config: effOrg
        ? await getOrgReviewAgentConfig(ctx.token, effOrg, platform)
        : await getPersonalReviewConfig(ctx.token, platform),
    }),
    [ctx.token, effOrg, platform],
  )
  // During a platform/scope reload `result` still holds the previous fetch —
  // only trust it when it was fetched for the current platform and scope.
  const config =
    result && result.platform === platform && result.org === effOrg ? result.config : undefined

  const fail = (e: unknown, what: string) =>
    setNotice({
      text: `${what} failed: ${e instanceof Error ? e.message : String(e)}`,
      error: true,
    })

  const doToggle = async () => {
    if (!config || loading) return
    setBusy(true)
    try {
      const next = !config.isEnabled
      if (effOrg) await toggleReviewAgent(ctx.token, effOrg, platform, next)
      else await togglePersonalReviewAgent(ctx.token, platform, next)
      setNotice({ text: `Agent ${next ? 'enabled' : 'disabled'} (${platform})`, error: false })
      reload()
    } catch (e) {
      fail(e, 'Toggle')
    } finally {
      setBusy(false)
    }
  }

  useInput(
    (input, key) => {
      if (editing) {
        if (key.escape) setEditing(false)
        return
      }
      if (key.escape) {
        if (confirmToggle) setConfirmToggle(false)
        else ctx.goBack()
        return
      }
      if (busy) return
      if (input === 'r') {
        reload()
        return
      }
      // While (re)loading, `config` may describe the previous platform/scope —
      // don't let mutations act on stale state.
      if (loading) return
      if (input === 'p') {
        setPlatform((p) => (p === 'github' ? 'gitlab' : 'github'))
        setConfirmToggle(false)
        setNotice(null)
      }
      if (input === 'o' && orgId) {
        setUseOrg((v) => !v)
        setConfirmToggle(false)
        setNotice(null)
      }
      if (input === 'm') {
        setModel(config?.modelSlug ?? '')
        setEditing(true)
        setConfirmToggle(false)
      }
      if (input === 't') {
        if (!config || confirmToggle) {
          if (confirmToggle) {
            setConfirmToggle(false)
            void doToggle()
          }
          return
        }
        setConfirmToggle(true)
      }
    },
    { isActive: focused },
  )

  if (loading && !config) return <Text color="yellow">Loading review agent config…</Text>
  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {clean(error)}</Text>
        <Text dimColor>p=switch platform r=retry Esc=back</Text>
      </Box>
    )
  }
  if (!config) return null

  const scope = effOrg ? `org ${effOrg}` : 'personal'
  return (
    <Box flexDirection="column">
      <RecordView
        data={{
          scope,
          platform,
          enabled: config.isEnabled ? 'yes' : 'no',
          model: config.modelSlug ?? '-',
          style: config.reviewStyle ?? '-',
          'gate threshold': config.gateThreshold ?? '-',
          'focus areas': config.focusAreas?.length ? config.focusAreas.join(', ') : '-',
          repositories: config.repositorySelectionMode ?? '-',
        }}
      />
      {config.actionRequired ? (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">Needs attention: {clean(config.actionRequired.reason)}</Text>
          {config.actionRequired.lastErrorMessage ? (
            <Text color="yellow">{clean(config.actionRequired.lastErrorMessage)}</Text>
          ) : null}
        </Box>
      ) : null}
      {notice ? <Text color={notice.error ? 'red' : 'green'}>{clean(notice.text)}</Text> : null}
      {editing ? (
        <Box marginTop={1}>
          <Text>Model slug: </Text>
          <TextInput
            value={model}
            onChange={setModel}
            focus={focused}
            onSubmit={async (v) => {
              setEditing(false)
              if (!v.trim() || v.trim() === config.modelSlug) return
              setBusy(true)
              try {
                const input = toSaveReviewConfigInput(platform, config, { modelSlug: v.trim() })
                if (effOrg) await saveOrgReviewConfig(ctx.token, effOrg, input)
                else await savePersonalReviewConfig(ctx.token, input)
                setNotice({ text: `Model set to ${v.trim()} (${platform})`, error: false })
                reload()
              } catch (e) {
                fail(e, 'Set model')
              } finally {
                setBusy(false)
              }
            }}
          />
        </Box>
      ) : confirmToggle ? (
        <Box marginTop={1}>
          <Text color="yellow">
            {config.isEnabled ? 'Disable' : 'Enable'} review agent for {platform} ({scope})? Press t
            to confirm, Esc to cancel.
          </Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor>
            p=platform{orgId ? ' o=scope' : ''} t=toggle m=set model r=refresh Esc=back
          </Text>
        </Box>
      )}
    </Box>
  )
}
