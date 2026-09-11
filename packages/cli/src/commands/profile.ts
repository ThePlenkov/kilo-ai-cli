/**
 * Profile CLI command handlers.
 */

import { defineCommand } from 'citty'

import { fetchBalance, fetchProfileWithBalance } from '../api/profile.ts'
import { getToken } from './helpers.ts'

export const profileCommand = defineCommand({
  meta: { name: 'profile', description: 'Show your kilo.ai profile' },
  async run() {
    const { token, organizationId } = await getToken()
    const { profile, balance } = await fetchProfileWithBalance(token)
    console.log(`Email: ${profile.email}`)
    if (profile.name) console.log(`Name: ${profile.name}`)
    if (balance) console.log(`Balance: $${balance.balance.toFixed(2)}`)
    if (organizationId) console.log(`Active Organization: ${organizationId}`)
  },
})

export const balanceCommand = defineCommand({
  meta: { name: 'balance', description: 'Show your credit balance' },
  async run() {
    const { token, organizationId } = await getToken()
    const balance = await fetchBalance(token, organizationId)
    if (balance) {
      console.log(`$${balance.balance.toFixed(2)}`)
    } else {
      console.log('Unable to fetch balance.')
    }
  },
})
