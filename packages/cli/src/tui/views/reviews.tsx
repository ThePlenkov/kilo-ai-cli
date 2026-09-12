import React from 'react'
import { Text } from 'ink'

import { getCodeReview, listCodeReviews, listCodeReviewsForUser } from '../../api/code-reviews.ts'
import type { CodeReview } from '../../api/types.ts'
import { QueryListScreen, QueryRecordScreen } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

const STATUS_COLORS: Record<string, string> = {
  completed: 'green',
  failed: 'red',
  running: 'yellow',
  pending: 'yellow',
}

/** Cloud → Code Reviewer: personal reviews, or org reviews when org context is set. */
export function ReviewsScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<CodeReview>
      focused={focused}
      fetch={() =>
        ctx.organizationId
          ? listCodeReviews(ctx.token, ctx.organizationId)
          : listCodeReviewsForUser(ctx.token)
      }
      columns={[
        { label: 'ID', width: 10, value: (r) => r.id.slice(0, 8) },
        { label: 'Title', width: 42, value: (r) => r.pr_title ?? '-' },
        {
          label: 'Status',
          width: 12,
          value: (r) => r.status,
          color: (r) => STATUS_COLORS[r.status],
        },
        { label: 'Repo', width: 30, value: (r) => r.repo_full_name ?? '-' },
        { label: 'PR', width: 6, align: 'right', value: (r) => String(r.pr_number ?? '-') },
        { label: 'Model', width: 26, value: (r) => r.model ?? '-' },
      ]}
      banner={() => (
        <Text dimColor>{ctx.organizationId ? 'org reviews' : 'personal reviews'}</Text>
      )}
      onSelect={(r) => ctx.navigate('review-detail', { id: r.id })}
      onBack={ctx.goBack}
      emptyText="No code reviews."
    />
  )
}

/** Cloud → review detail: review fields + attempts table. */
export function ReviewDetailScreen({ ctx, focused }: ScreenProps) {
  const id = ctx.route.params.id ?? ''
  return (
    <QueryRecordScreen
      focused={focused}
      fetch={async () => {
        const { review, attempts, tokenUsage } = await getCodeReview(ctx.token, id)
        return {
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
          attempts: attempts.length,
          tokens: tokenUsage ? `in ${tokenUsage.input} / out ${tokenUsage.output} / cached ${tokenUsage.cached}` : '-',
        }
      }}
      onBack={ctx.goBack}
    />
  )
}
