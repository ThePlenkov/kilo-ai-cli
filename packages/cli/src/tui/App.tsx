import React, { useCallback, useState } from 'react'
import { Box, Text } from 'ink'

import type { FindingsFilter, TuiView } from './types.ts'
import { FindingsListView } from './views/FindingsListView.tsx'
import { FindingDetailView } from './views/FindingDetailView.tsx'
import { StatsView } from './views/StatsView.tsx'
import { DashboardView } from './views/DashboardView.tsx'
import { MenuView } from './views/MenuView.tsx'

export interface AppProps {
  token: string
}

export function App({ token }: AppProps) {
  const [view, setView] = useState<TuiView>('menu')
  const [filter, setFilter] = useState<FindingsFilter>({ limit: 50, offset: 0 })
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null)

  const navigate = useCallback((next: TuiView) => setView(next), [])

  const openFinding = useCallback((id: string) => {
    setSelectedFindingId(id)
    setView('finding-detail')
  }, [])

  const backToFindings = useCallback(() => {
    setSelectedFindingId(null)
    setView('findings')
  }, [])

  const backToMenu = useCallback(() => {
    setSelectedFindingId(null)
    setView('menu')
  }, [])

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">══ Kilo Security Agent TUI ══</Text>
      </Box>

      {view === 'menu' && (
        <MenuView
          onSelect={(v) => {
            if (v === 'exit') {
              process.exit(0)
            }
            navigate(v)
          }}
        />
      )}

      {view === 'findings' && (
        <FindingsListView
          token={token}
          filter={filter}
          onFilterChange={setFilter}
          onSelectFinding={openFinding}
          onBack={backToMenu}
        />
      )}

      {view === 'finding-detail' && selectedFindingId && (
        <FindingDetailView
          token={token}
          findingId={selectedFindingId}
          onBack={backToFindings}
        />
      )}

      {view === 'stats' && (
        <StatsView token={token} onBack={backToMenu} />
      )}

      {view === 'dashboard' && (
        <DashboardView token={token} onBack={backToMenu} />
      )}
    </Box>
  )
}
// mergeability recompute trigger
