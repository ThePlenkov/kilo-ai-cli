/**
 * Authentication CLI command handlers.
 */

import { defineCommand } from 'citty'

import { fetchProfile } from '../api/profile.ts'
import { authenticateWithDeviceAuth } from '../auth/device-auth.ts'
import { createTokenStore } from '../auth/token-store.ts'

export const loginCommand = defineCommand({
  meta: { name: 'login', description: 'Authenticate with kilo.ai via browser' },
  async run() {
    const result = await authenticateWithDeviceAuth()
    const store = createTokenStore()
    await store.set(result.auth)
    console.log(`Authenticated as ${result.userEmail}`)
  },
})

export const logoutCommand = defineCommand({
  meta: { name: 'logout', description: 'Clear stored authentication' },
  async run() {
    const store = createTokenStore()
    await store.clear()
    console.log('Successfully logged out.')
  },
})

export const statusCommand = defineCommand({
  meta: { name: 'status', description: 'Show authentication status' },
  async run() {
    const store = createTokenStore()
    const auth = await store.get()
    if (!auth) {
      console.log('Not authenticated. Run `kilo-ai-cli auth login` to sign in.')
      return
    }

    const token = auth.type === 'api' ? auth.key : auth.type === 'oauth' ? auth.access : auth.token
    const profile = await fetchProfile(token)
    console.log(`Authenticated as ${profile.email}`)
    if (profile.name) {
      console.log(`Name: ${profile.name}`)
    }
    if (profile.organizations && profile.organizations.length > 0) {
      console.log('Organizations:')
      for (const org of profile.organizations) {
        const active = org.id === profile.selectedOrganizationId ? ' (active)' : ''
        console.log(`  ${org.name} — ${org.role}${active}`)
      }
    }
  },
})
