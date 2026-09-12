import React from 'react'
import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'

import type { TuiView } from '../types.ts'

export interface MenuViewProps {
  onSelect: (view: TuiView | 'exit') => void
}

const ITEMS = [
  { label: 'Findings — browse & filter security findings', value: 'findings' as const },
  { label: 'Stats — security agent statistics', value: 'stats' as const },
  { label: 'Dashboard — repo health & trends', value: 'dashboard' as const },
  { label: 'Exit', value: 'exit' as const },
]

export function MenuView({ onSelect }: MenuViewProps) {
  return (
    <Box flexDirection="column">
      <Text dimColor>Use arrow keys to navigate, Enter to select.</Text>
      <Box marginTop={1}>
        <SelectInput items={ITEMS} onSelect={(item) => onSelect(item.value)} />
      </Box>
    </Box>
  )
}
