/**
 * Feedback CLI command handlers.
 */

import { defineCommand } from 'citty'

import { submitFeedback } from '../api/feedback.ts'
import { getToken } from './helpers.ts'

export const feedbackSendCommand = defineCommand({
  meta: { name: 'send', description: 'Send feedback to the Kilo team' },
  args: {
    text: { type: 'positional', description: 'Feedback text', required: true },
    for: { type: 'string', description: 'What the feedback is about' },
    batch: { type: 'string', description: 'Batch identifier' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await submitFeedback(token, {
      feedback_text: args.text,
      feedback_for: args.for,
      feedback_batch: args.batch,
      source: 'kilo-ai-cli',
    })
    console.log('Feedback sent. Thanks!')
  },
})
