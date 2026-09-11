import { defineCommand } from 'citty'
import { render } from 'ink'
import React from 'react'

import { App } from '../tui/App.tsx'
import { getToken } from './helpers.ts'

export const tuiCommand = defineCommand({
  meta: { name: 'tui', description: 'Launch interactive TUI for security agent' },
  async run() {
    const { token } = await getToken()
    render(React.createElement(App, { token }))
  },
})
