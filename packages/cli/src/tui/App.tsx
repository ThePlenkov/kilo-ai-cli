import React, { useCallback, useMemo, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'

import { Sidebar, type SidebarItem } from './components.tsx'
import { SCREENS } from './screens.tsx'
import type { Route, ScreenCtx } from './types.ts'

export interface AppProps {
  token: string
  organizationId?: string
}

interface NavEntry {
  name: string
  group: string
  title: string
}

export function App({ token, organizationId }: AppProps) {
  const navScreens = useMemo<NavEntry[]>(
    () => SCREENS.filter((s) => !s.hidden).map((s) => ({ name: s.name, group: s.group, title: s.title })),
    [],
  )
  const groups = useMemo(() => {
    const out: { title: string; items: NavEntry[] }[] = []
    for (const s of navScreens) {
      const g = out.find((x) => x.title === s.group)
      if (g) g.items.push(s)
      else out.push({ title: s.group, items: [s] })
    }
    return out
  }, [navScreens])

  const [stack, setStack] = useState<Route[]>([{ name: 'profile', params: {} }])
  const [focus, setFocus] = useState<'nav' | 'content'>('nav')
  const [navIdx, setNavIdx] = useState(0)

  const route = stack[stack.length - 1]!
  const screen = SCREENS.find((s) => s.name === route.name) ?? SCREENS[0]!
  const leafName = stack[0]!.name

  const navigate = useCallback((name: string, params: Record<string, string> = {}) => {
    setStack((p) => [...p, { name, params }])
  }, [])

  const goBack = useCallback(() => {
    // Popping to the root screen returns keyboard focus to the sidebar.
    const nextLen = Math.max(1, stack.length - 1)
    setStack((p) => (p.length > 1 ? p.slice(0, -1) : p))
    setFocus(nextLen > 1 ? 'content' : 'nav')
  }, [stack.length])

  const select = useCallback(
    (name: string) => {
      setStack([{ name, params: {} }])
      setFocus('content')
    },
    [],
  )

  useInput(
    (input, key) => {
      if (key.upArrow) setNavIdx((i) => (i - 1 + navScreens.length) % navScreens.length)
      if (key.downArrow) setNavIdx((i) => (i + 1) % navScreens.length)
      if (key.return || key.rightArrow) select(navScreens[navIdx]!.name)
      if (input === 'q') process.exit(0)
    },
    { isActive: focus === 'nav' },
  )

  const ctx: ScreenCtx = { token, organizationId, route, navigate, goBack }
  const Screen = screen.component

  const { stdout } = useStdout()
  const termRows = stdout?.rows ?? 24
  // header line + its margin (2), footer margin + line (2) → body budget
  const bodyHeight = Math.max(6, termRows - 4)

  const sidebarGroups: { title: string; items: SidebarItem[] }[] = groups.map((g) => ({
    title: g.title,
    items: g.items.map((i) => ({ name: i.name, title: i.title, active: i.name === leafName })),
  }))

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Kilo
        </Text>
        <Text dimColor>
          {'  '}cloud console{organizationId ? ` · org ${organizationId.slice(0, 8)}…` : ' · personal'}
          {stack.length > 1 ? ` · ${stack.map((r) => r.name).join(' › ')}` : ''}
        </Text>
      </Box>
      <Box flexDirection="row" height={bodyHeight} overflow="hidden">
        <Sidebar groups={sidebarGroups} selected={navIdx} focused={focus === 'nav'} height={bodyHeight} />
        <Box flexDirection="column" flexGrow={1} paddingLeft={2} overflow="hidden">
          <Box marginBottom={1}>
            <Text bold>{screen.title}</Text>
          </Box>
          <Screen
            key={`${route.name}:${JSON.stringify(route.params)}`}
            ctx={ctx}
            focused={focus === 'content'}
          />
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {focus === 'nav' ? '↑↓ navigate · Enter/→ open · q quit' : 'Esc back · ←/nav via Esc'}
        </Text>
      </Box>
    </Box>
  )
}
