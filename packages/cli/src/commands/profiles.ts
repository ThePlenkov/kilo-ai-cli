/**
 * Agent profile CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  bindProfileToRepo,
  clearDefaultAgentProfile,
  createAgentProfile,
  deleteAgentProfile,
  deleteProfileVariable,
  getAgentProfile,
  listAgentProfiles,
  listProfileRepoBindings,
  setDefaultAgentProfile,
  setProfileCommands,
  setProfileVariable,
  unbindProfileFromRepo,
  updateAgentProfile,
} from '../api/profiles.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

export const profilesListCommand = defineCommand({
  meta: { name: 'list', description: 'List agent profiles' },
  args: { org: { type: 'string', description: 'Organization ID' } },
  async run({ args }) {
    const { token } = await getToken()
    const profiles = await listAgentProfiles(token, args.org)
    if (profiles.length === 0) {
      console.log('No agent profiles found.')
      return
    }
    printTable(
      profiles.map((p) => ({
        id: p.id,
        name: p.name,
        default: p.isDefault ? 'yes' : 'no',
        vars: p.varCount ?? 0,
        cmds: p.commandCount ?? 0,
        mcps: p.mcpServerCount ?? 0,
        skills: p.skillCount ?? 0,
        agents: p.agentCount ?? 0,
      })),
      [
        { key: 'id', label: 'ID', width: 36 },
        { key: 'name', label: 'Name', width: 24 },
        { key: 'default', label: 'Default', width: 8 },
        { key: 'vars', label: 'Vars', width: 6, align: 'right' },
        { key: 'cmds', label: 'Cmds', width: 6, align: 'right' },
        { key: 'mcps', label: 'MCPs', width: 6, align: 'right' },
        { key: 'skills', label: 'Skills', width: 7, align: 'right' },
        { key: 'agents', label: 'Agents', width: 7, align: 'right' },
      ],
    )
  },
})

export const profilesGetCommand = defineCommand({
  meta: { name: 'get', description: 'Get one agent profile' },
  args: {
    id: { type: 'positional', description: 'Profile ID', required: true },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const profile = await getAgentProfile(token, args.id, args.org)
    console.log(`  id: ${profile.id}`)
    console.log(`  name: ${profile.name}`)
    console.log(`  description: ${profile.description ?? '-'}`)
    console.log(`  default: ${profile.isDefault ? 'yes' : 'no'}`)
    if (profile.variables && Object.keys(profile.variables).length > 0) {
      console.log('  variables:')
      for (const [key, value] of Object.entries(profile.variables)) {
        console.log(`    ${key} = ${typeof value === 'string' ? value : JSON.stringify(value)}`)
      }
    }
    if (profile.repoBindings?.length) {
      console.log('  repositories:')
      for (const binding of profile.repoBindings) {
        console.log(`    ${JSON.stringify(binding)}`)
      }
    }
  },
})

export const profilesCreateCommand = defineCommand({
  meta: { name: 'create', description: 'Create an agent profile' },
  args: {
    name: { type: 'positional', description: 'Profile name', required: true },
    description: { type: 'string', description: 'Profile description' },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const { id } = await createAgentProfile(token, args.name, args.description, args.org)
    console.log(`Created profile ${id} (${args.name})`)
  },
})

export const profilesUpdateCommand = defineCommand({
  meta: { name: 'update', description: 'Update an agent profile' },
  args: {
    id: { type: 'positional', description: 'Profile ID', required: true },
    name: { type: 'string', description: 'New name' },
    description: { type: 'string', description: 'New description' },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await updateAgentProfile(
      token,
      args.id,
      { name: args.name, description: args.description },
      args.org,
    )
    console.log(`Updated profile ${args.id}`)
  },
})

export const profilesDeleteCommand = defineCommand({
  meta: { name: 'delete', description: 'Delete an agent profile' },
  args: {
    id: { type: 'positional', description: 'Profile ID', required: true },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await deleteAgentProfile(token, args.id, args.org)
    console.log(`Deleted profile ${args.id}`)
  },
})

export const profilesDefaultCommand = defineCommand({
  meta: { name: 'default', description: 'Make a profile the default one' },
  args: {
    id: { type: 'positional', description: 'Profile ID', required: true },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await setDefaultAgentProfile(token, args.id, args.org)
    console.log(`Profile ${args.id} is now the default.`)
  },
})

export const profilesClearDefaultCommand = defineCommand({
  meta: { name: 'clear-default', description: 'Clear the default profile' },
  args: {
    id: { type: 'positional', description: 'Profile ID', required: true },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await clearDefaultAgentProfile(token, args.id, args.org)
    console.log(`Profile ${args.id} is no longer the default.`)
  },
})

export const profilesSetVarCommand = defineCommand({
  meta: { name: 'set-var', description: 'Set a profile variable' },
  args: {
    id: { type: 'positional', description: 'Profile ID', required: true },
    key: { type: 'positional', description: 'Variable name', required: true },
    value: {
      type: 'positional',
      description:
        'Variable value (or set KILO_PROFILE_VAR_VALUE — CLI args are visible in shell history)',
      required: false,
    },
    secret: { type: 'boolean', description: 'Mark the value as secret' },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    // Secrets must not travel as CLI arguments — they end up in shell history
    // and in /proc/<pid>/cmdline. The environment variable wins.
    const value = process.env.KILO_PROFILE_VAR_VALUE ?? args.value
    if (value === undefined) {
      throw new Error('Provide a value or set KILO_PROFILE_VAR_VALUE.')
    }
    await setProfileVariable(
      token,
      args.id,
      { key: args.key, value, isSecret: args.secret ?? false },
      args.org,
    )
    console.log(`Set ${args.key} on profile ${args.id}`)
  },
})

export const profilesDelVarCommand = defineCommand({
  meta: { name: 'del-var', description: 'Delete a profile variable' },
  args: {
    id: { type: 'positional', description: 'Profile ID', required: true },
    key: { type: 'positional', description: 'Variable name', required: true },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await deleteProfileVariable(token, args.id, args.key, args.org)
    console.log(`Deleted ${args.key} from profile ${args.id}`)
  },
})

export const profilesSetCommandsCommand = defineCommand({
  meta: { name: 'set-commands', description: 'Replace the slash commands of a profile' },
  args: {
    id: { type: 'positional', description: 'Profile ID', required: true },
    commands: { type: 'string', description: 'Command list (comma separated)', required: true },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const commands = args.commands
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    await setProfileCommands(token, args.id, commands, args.org)
    console.log(`Set ${commands.length} command(s) on profile ${args.id}`)
  },
})

export const profilesBindCommand = defineCommand({
  meta: { name: 'bind', description: 'Bind a profile to a repository' },
  args: {
    id: { type: 'positional', description: 'Profile ID', required: true },
    repo: { type: 'positional', description: 'Repository full name (owner/repo)', required: true },
    platform: { type: 'string', description: 'Platform (github|gitlab)', default: 'github' },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await bindProfileToRepo(
      token,
      args.id,
      args.repo,
      args.platform as 'github' | 'gitlab',
      args.org,
    )
    console.log(`Bound profile ${args.id} to ${args.repo}`)
  },
})

export const profilesUnbindCommand = defineCommand({
  meta: { name: 'unbind', description: 'Unbind a profile from a repository' },
  args: {
    repo: { type: 'positional', description: 'Repository full name (owner/repo)', required: true },
    platform: { type: 'string', description: 'Platform (github|gitlab)', default: 'github' },
    org: { type: 'string', description: 'Organization ID' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await unbindProfileFromRepo(token, args.repo, args.platform as 'github' | 'gitlab', args.org)
    console.log(`Unbound ${args.repo}`)
  },
})

export const profilesBindingsCommand = defineCommand({
  meta: { name: 'bindings', description: 'List profile-to-repository bindings' },
  args: { org: { type: 'string', description: 'Organization ID' } },
  async run({ args }) {
    const { token } = await getToken()
    const bindings = await listProfileRepoBindings(token, args.org)
    if (bindings.length === 0) {
      console.log('No bindings found.')
      return
    }
    printTable(
      bindings.map((b) => ({
        repo: b.repoFullName,
        profile: b.profileName ?? b.profileId,
        platform: b.platform ?? '-',
      })),
      [
        { key: 'repo', label: 'Repository', width: 40 },
        { key: 'profile', label: 'Profile', width: 36 },
        { key: 'platform', label: 'Platform', width: 10 },
      ],
    )
  },
})
