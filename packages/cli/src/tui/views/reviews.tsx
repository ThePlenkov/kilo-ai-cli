import React from 'react'
import { Box, Text, useInput, useStdout } from 'ink'

import { getCodeReview, listCodeReviews, listCodeReviewsForUser } from '../../api/code-reviews.ts'
import type { CodeReview } from '../../api/types.ts'
import { useQuery } from '../hooks.ts'
import { DataTable, QueryListScreen, RecordView } from '../components.tsx'
import type { Column } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

const STATUS_COLORS: Record<string, string> = {
  completed: 'green',
  failed: 'red',
  running: 'yellow',
  pending: 'yellow',
}

/** Cloud → Code Reviewer: personal reviews, or org reviews when org context is set. */
export function ReviewsScreen({ ctx, focused }: ScreenProps) {
  const { stdout } = useStdout()
  // Sidebar (26) + padding eats ~32 cols; size the table to the content pane.
  const avail = Math.max(40, (stdout?.columns ?? 80) - 34)
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
      banner={() => (
        <Text dimColor>{ctx.organizationId ? 'org reviews' : 'personal reviews'}</Text>
      )}
      onSelect={(r) => ctx.navigate('review-detail', { id: r.id })}
      onBack={ctx.goBack}
      emptyText="No code reviews."
    />
  )
}

/** Cloud → review detail: review record + attempts table. */
export function ReviewDetailScreen({ ctx, focused }: ScreenProps) {
  const { stdout } = useStdout()
  // Record view ~15 rows + attempts header/legend + footer → cap attempt rows.
  const maxAttempts = Math.max(2, (stdout?.rows ?? 24) - 22)
  const id = ctx.route.params.id ?? ''
  const { data, error, loading, reload } = useQuery(() => getCodeReview(ctx.token, id), [ctx.token, id])

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
        <Text dimColor>r=retry  Esc=back</Text>
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
          tokens: tokenUsage ? `in ${tokenUsage.input} / out ${tokenUsage.output} / cached ${tokenUsage.cached}` : '-',
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
              { label: 'Status', width: 12, value: (a) => a.status, color: (a) => STATUS_COLORS[a.status] },
              { label: 'Started', width: 20, value: (a) => a.started_at ?? '-' },
              { label: 'Completed', width: 20, value: (a) => a.completed_at ?? '-' },
              { label: 'Error', width: 30, value: (a) => a.error_message ?? '-' },
            ]}
          />
          {attempts.length > maxAttempts ? (
            <Text dimColor>  … {attempts.length - maxAttempts} more attempts</Text>
          ) : null}
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>r=refresh  Esc=back</Text>
      </Box>
    </Box>
  )
}
