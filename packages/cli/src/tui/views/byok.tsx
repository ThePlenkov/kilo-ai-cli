import React from 'react'

import { fetchByokEntries } from '../../api/trpc.ts'
import type { ByokEntry } from '../../api/types.ts'
import { QueryListScreen } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

/** Account → BYOK: bring-your-own-key entries. */
export function ByokScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<ByokEntry>
      focused={focused}
      fetch={() => fetchByokEntries(ctx.token, ctx.organizationId)}
      columns={[
        { label: 'ID', width: 38, value: (e) => e.id },
        { label: 'Provider', width: 24, value: (e) => e.provider_id },
        { label: 'Source', width: 14, value: (e) => e.management_source },
        {
          label: 'Enabled',
          width: 8,
          value: (e) => (e.is_enabled ? 'yes' : 'no'),
          color: (e) => (e.is_enabled ? 'green' : 'gray'),
        },
      ]}
      onBack={ctx.goBack}
      emptyText="No BYOK entries."
    />
  )
}
