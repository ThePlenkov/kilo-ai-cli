import { defineCommand } from 'citty'
import { render } from 'ink'
import React from 'react'

import { App } from '../tui/App.tsx'
import { getToken } from './helpers.ts'

export const tuiCommand = defineCommand({
  meta: { name: 'tui', description: 'Launch interactive TUI for security agent' },
  async run() {
    const { token } = await getToken()
    if (!token) {
      console.error('Not authenticated. Run: kilo-ai-cli auth login')
      process.exit(1)
    }
    render(React.createElement(App, { token }))
  },
})
