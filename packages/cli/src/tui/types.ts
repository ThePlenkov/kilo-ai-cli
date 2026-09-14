/** TUI view state and navigation types. */

import type React from 'react'

/** A route on the navigation stack. `name` maps to a screen in the registry. */
export interface Route {
  name: string
  params: Record<string, string>
}

/** Context handed to every screen. */
export interface ScreenCtx {
  token: string
  organizationId?: string
  route: Route
  navigate: (name: string, params?: Record<string, string>) => void
  goBack: () => void
}

export interface ScreenProps {
  ctx: ScreenCtx
  /** Whether the content pane (not the sidebar) currently owns keyboard input. */
  focused: boolean
}

export interface ScreenDef {
  name: string
  /** Sidebar group title (website-style nav grouping). */
  group: string
  title: string
  /** Detail screens are reachable via navigate() but hidden from the sidebar. */
  hidden?: boolean
  component: React.ComponentType<ScreenProps>
}

export interface FindingsFilter {
  severity?: string
  status?: string
  repoFullName?: string
  limit: number
  offset: number
}
