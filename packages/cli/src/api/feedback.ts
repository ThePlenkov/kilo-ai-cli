/**
 * Feedback submission to the Kilo team.
 * Source: Kilo-Org/cloud apps/web/src/routers/feedback-router.ts
 */

import { z } from 'zod'
import { trpcMutate } from './client.ts'

/** feedback.submit — send free-form feedback. */
export async function submitFeedback(
  token: string,
  input: {
    feedback_text: string
    feedback_for?: string
    feedback_batch?: string
    source?: string
    context_json?: Record<string, unknown>
  },
): Promise<unknown> {
  return trpcMutate('feedback.submit', token, z.unknown(), {
    ...input,
    feedback_for: input.feedback_for ?? 'unknown',
    source: input.source ?? 'kilo-ai-cli',
    context_json: input.context_json ?? {},
  })
}
