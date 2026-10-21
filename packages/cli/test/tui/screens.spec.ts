import { render } from 'ink'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SCREENS } from '../../src/tui/screens.tsx'
import type { ScreenCtx } from '../../src/tui/types.ts'

/** Minimal stdout that collects what ink writes. */
function fakeStdout() {
  const chunks: string[] = []
  return {
    write: (chunk: string) => {
      chunks.push(chunk)
      return true
    },
    on: () => undefined,
    off: () => undefined,
    once: () => undefined,
    removeListener: () => undefined,
    columns: 120,
    rows: 40,
    chunks,
  }
}

const ctx: ScreenCtx = {
  token: 'test-token',
  organizationId: undefined,
  route: { name: 'profile', params: {} },
  navigate: () => {},
  goBack: () => {},
}

/** Screen names that need a route parameter to render something useful. */
const PARAM_SCREENS = new Set([
  'session',
  'review-detail',
  'security-finding',
  'todo-items',
  'agent-profile',
])

describe('TUI screen registry', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: () => Promise.resolve(JSON.stringify({ result: { data: { json: [] } } })),
    }) as unknown as typeof fetch
  })
  afterEach(() => vi.restoreAllMocks())

  it('registers every screen with a group and a component', () => {
    expect(SCREENS.length).toBeGreaterThan(0)
    for (const screen of SCREENS) {
      expect(screen.name).toBeTruthy()
      expect(screen.group).toBeTruthy()
      expect(screen.title).toBeTruthy()
      expect(screen.component).toBeTypeOf('function')
    }
  })

  it('uses unique screen names', () => {
    const names = SCREENS.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('covers the new feature areas', () => {
    const names = SCREENS.map((s) => s.name)
    for (const expected of [
      'account',
      'todos',
      'todo-items',
      'up-next',
      'profiles',
      'briefing',
      'webhooks',
      'models',
      'integrations',
      'cursors',
      'unified-sessions',
      'active-sessions',
    ]) {
      expect(names).toContain(expected)
    }
  })

  // Rendering ~40 screens with a tick each can exceed the default 5s budget
  // on a loaded machine.
  it('renders every screen without throwing', { timeout: 30_000 }, async () => {
    for (const screen of SCREENS) {
      const stdout = fakeStdout()
      const instance = render(
        React.createElement(screen.component, {
          ctx: {
            ...ctx,
            route: {
              name: screen.name,
              params: PARAM_SCREENS.has(screen.name) ? { id: 'x' } : {},
            },
          },
          focused: false,
        }),
        { stdout: stdout as unknown as NodeJS.WriteStream, debug: true },
      )
      // Give ink a tick to mount and run the first effect.
      // eslint-disable-next-line no-await-in-loop -- each screen is mounted in turn
      await new Promise((resolve) => setTimeout(resolve, 20))
      instance.unmount()
      // ink must have written something — a screen that renders nothing (or
      // an error box) would pass a type assertion on the joined output.
      expect(stdout.chunks.length).toBeGreaterThan(0)
    }
  })
})
