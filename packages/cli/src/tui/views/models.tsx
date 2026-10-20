import React from 'react'

import { getModelPreferences, listModels } from '../../api/models.ts'
import type { CloudModel } from '../../api/types.ts'
import { QueryListScreen } from '../components.tsx'
import { useQuery } from '../hooks.ts'
import type { ScreenProps } from '../types.ts'

/** Usage → Models: the model catalog with the favorites marked. */
export function ModelsScreen({ ctx, focused }: ScreenProps) {
  const { data: prefs } = useQuery(
    () => getModelPreferences(ctx.token, ctx.organizationId),
    [ctx.token],
  )
  const favorites = new Set(prefs?.favorites ?? [])
  return (
    <QueryListScreen<CloudModel>
      focused={focused}
      fetch={() => listModels(ctx.token)}
      columns={[
        { label: 'ID', width: 40, value: (m) => m.id },
        { label: 'Name', width: 40, value: (m) => m.name },
        {
          label: 'Vision',
          width: 8,
          value: (m) => (m.supportsVision ? 'yes' : 'no'),
        },
        {
          label: '★',
          width: 2,
          value: (m) => (favorites.has(m.id) ? '★' : ''),
          color: () => 'yellow',
        },
      ]}
      onBack={ctx.goBack}
      emptyText="No models available."
    />
  )
}
