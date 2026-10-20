/**
 * Model catalog and model preference CLI command handlers.
 */

import { defineCommand } from 'citty'

import {
  addFavoriteModel,
  clearLastSelectedModel,
  getModelPreferences,
  listModels,
  listPreferredModels,
  removeFavoriteModel,
  setLastSelectedModel,
} from '../api/models.ts'
import { printTable } from './format.ts'
import { getToken } from './helpers.ts'

export const modelsListCommand = defineCommand({
  meta: { name: 'list', description: 'List the models available to the account' },
  async run() {
    const { token } = await getToken()
    const models = await listModels(token)
    if (models.length === 0) {
      console.log('No models available.')
      return
    }
    printTable(
      models.map((m) => ({
        id: m.id,
        name: m.name,
        vision: m.supportsVision ? 'yes' : 'no',
        preferred: m.isPreferred ? 'yes' : 'no',
      })),
      [
        { key: 'id', label: 'ID', width: 40 },
        { key: 'name', label: 'Name', width: 40 },
        { key: 'vision', label: 'Vision', width: 8 },
        { key: 'preferred', label: 'Preferred', width: 10 },
      ],
    )
  },
})

export const modelsPreferredCommand = defineCommand({
  meta: { name: 'preferred', description: 'List the preferred model ids' },
  async run() {
    const { token } = await getToken()
    const ids = await listPreferredModels(token)
    if (ids.length === 0) {
      console.log('No preferred models.')
      return
    }
    for (const id of ids) console.log(id)
  },
})

export const modelsFavoritesCommand = defineCommand({
  meta: { name: 'favorites', description: 'Show the favorite models' },
  args: { org: { type: 'string', description: 'Organization ID' } },
  async run({ args }) {
    const { token } = await getToken()
    const prefs = await getModelPreferences(token, args.org)
    if (prefs.favorites.length === 0) {
      console.log('No favorite models.')
      return
    }
    for (const id of prefs.favorites) console.log(id)
    if (prefs.lastSelected) {
      console.log(`\nLast selected: ${prefs.lastSelected.model}`)
    }
  },
})

export const modelsFavoriteCommand = defineCommand({
  meta: { name: 'favorite', description: 'Add a model to the favorites' },
  args: { model: { type: 'positional', description: 'Model ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await addFavoriteModel(token, args.model)
    console.log(`Favorited ${args.model}`)
  },
})

export const modelsUnfavoriteCommand = defineCommand({
  meta: { name: 'unfavorite', description: 'Remove a model from the favorites' },
  args: { model: { type: 'positional', description: 'Model ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await removeFavoriteModel(token, args.model)
    console.log(`Unfavorited ${args.model}`)
  },
})

export const modelsUseCommand = defineCommand({
  meta: { name: 'use', description: 'Remember the last selected model' },
  args: {
    model: { type: 'positional', description: 'Model ID', required: true },
    variant: { type: 'string', description: 'Model variant' },
  },
  async run({ args }) {
    const { token } = await getToken()
    await setLastSelectedModel(token, args.model, args.variant)
    console.log(`Last selected model is now ${args.model}`)
  },
})

export const modelsClearUseCommand = defineCommand({
  meta: { name: 'clear-use', description: 'Forget the last selected model' },
  async run() {
    const { token } = await getToken()
    await clearLastSelectedModel(token)
    console.log('Last selected model cleared.')
  },
})
