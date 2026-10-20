import { describe, expect, it } from 'vitest'
import { reviewsCursorName } from '../../src/commands/code-reviews.ts'
import { findingsCursorName } from '../../src/commands/security-agent.ts'

describe('cursor names', () => {
  it('personal and organization reviews get separate cursors', () => {
    expect(reviewsCursorName()).toBe('reviews')
    expect(reviewsCursorName('org-1')).toBe('reviews:org-1')
    expect(reviewsCursorName('org-1')).not.toBe(reviewsCursorName('org-2'))
  })

  it('unfiltered findings use the shared cursor', () => {
    expect(findingsCursorName({})).toBe('security-findings')
  })

  it('filtered findings get their own cursor', () => {
    const bySeverity = findingsCursorName({ severity: 'high' })
    const byRepo = findingsCursorName({ repoFullName: 'owner/repo' })

    expect(bySeverity).toBe('security-findings:high')
    expect(byRepo).toBe('security-findings:owner/repo')
    expect(bySeverity).not.toBe(byRepo)
    expect(bySeverity).not.toBe(findingsCursorName({}))
  })

  it('distinguishes findings by every filter that narrows the result', () => {
    const names = new Set([
      findingsCursorName({ severity: 'high' }),
      findingsCursorName({ status: 'open' }),
      findingsCursorName({ outcomeFilter: 'fixed' }),
      findingsCursorName({ overdue: true }),
    ])
    expect(names.size).toBe(4)
  })
})
