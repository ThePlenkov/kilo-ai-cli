import { defineCommand } from 'citty'
import { render } from 'ink'
import React from 'react'

import { getToken } from './helpers.ts'

export const tuiCommand = defineCommand({
  meta: { name: 'tui', description: 'Launch interactive TUI' },
  async run() {
    const { token, organizationId } = await getToken()
    if (!token) {
      console.error('Not authenticated. Run: kilo-ai-cli auth login')
      process.exit(1)
    }
    // Lazy import: keeps .tsx out of the static graph so `node src/index.ts`
    // (native TS) works for all non-TUI commands.
    const { App } = await import('../tui/App.tsx')
    render(React.createElement(App, { token, organizationId }))
  },
})
