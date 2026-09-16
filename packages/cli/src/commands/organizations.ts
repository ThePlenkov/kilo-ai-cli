/**
 * Organization CLI command handlers.
 */

import { defineCommand } from 'citty'
import { listOrganizations } from '../api/organizations.ts'
import { fetchProfile } from '../api/profile.ts'
import type { KiloAuth } from '../api/types.ts'
import { createTokenStore } from '../auth/token-store.ts'
import { printTable } from './format.ts'
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
    printTable(
      orgs.map((o) => ({
        id: o.id,
        name: o.name,
        role: o.role,
        active: o.id === organizationId ? 'yes' : '',
      })),
      [
        { key: 'id', label: 'ID', width: 36 },
        { key: 'name', label: 'Name', width: 30 },
        { key: 'role', label: 'Role', width: 12 },
        { key: 'active', label: 'Active', width: 8 },
      ],
    )
  },
})

export const orgSetCommand = defineCommand({
  meta: { name: 'set', description: 'Set active organization' },
  args: {
    id: { type: 'positional', description: 'Organization ID or name', required: true },
  },
  async run({ args }) {
    const { token, auth } = await getToken()
    // Verify the org exists by listing organizations
    const orgs = await listOrganizations(token)
    const idMatch = orgs.find((o) => o.id.toLowerCase() === args.id.toLowerCase())
    if (idMatch) {
      if (auth.type === 'oauth') {
        const updated: KiloAuth = { ...auth, accountId: idMatch.id }
        const store = createTokenStore()
        await store.set(updated)
        console.log(`Active organization set to ${idMatch.name} (${idMatch.id})`)
      } else {
        console.error('Organization switching requires OAuth authentication.')
        process.exitCode = 1
      }
      return
    }
    const nameMatches = orgs.filter((o) => o.name === args.id)
    if (nameMatches.length > 1) {
      console.error(`Organization name "${args.id}" is ambiguous; use its UUID from \`kilo-ai-cli org list\`.`)
      process.exitCode = 1
      return
    }
    const org = nameMatches[0]
    if (!org) {
      console.error(`Organization ${args.id} not found.`)
      process.exitCode = 1
      return
    }

    // Update stored auth with new accountId
    if (auth.type === 'oauth') {
      const updated: KiloAuth = {
        ...auth,
        accountId: org.id,
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
