/**
 * Organization CLI command handlers.
 */

import { defineCommand } from 'citty'

import { fetchProfile } from '../api/profile.ts'
import { fetchOrganizations } from '../api/trpc.ts'
import type { KiloAuth } from '../api/types.ts'
import { createTokenStore } from '../auth/token-store.ts'
import { getToken } from './helpers.ts'

export const orgListCommand = defineCommand({
  meta: { name: 'list', description: 'List your organizations' },
  async run() {
    const { token, organizationId } = await getToken()
    const profile = await fetchProfile(token)
    const orgs = profile.organizations ?? []
    if (orgs.length === 0) {
      console.log('No organizations found.')
      return
    }
    console.table(
      orgs.map((o) => ({
        ID: o.id,
        Name: o.name,
        Role: o.role,
        Active: o.id === organizationId ? 'yes' : '',
      })),
    )
  },
})

export const orgSetCommand = defineCommand({
  meta: { name: 'set', description: 'Set active organization' },
  args: {
    id: { type: 'positional', description: 'Organization ID', required: true },
  },
  async run({ args }) {
    const { token, auth } = await getToken()
    // Verify the org exists by listing organizations
    const orgs = await fetchOrganizations(token)
    const org = orgs.find((o) => o.id === args.id)
    if (!org) {
      console.error(`Organization ${args.id} not found.`)
      process.exitCode = 1
      return
    }

    // Update stored auth with new accountId
    if (auth.type === 'oauth') {
      const updated: KiloAuth = {
        ...auth,
        accountId: args.id,
      }
      const store = createTokenStore()
      await store.set(updated)
      console.log(`Active organization set to ${org.name} (${org.id})`)
    } else {
      console.error('Organization switching requires OAuth authentication.')
      process.exitCode = 1
    }
  },
})
