/**
 * Model catalog and per-user model preferences.
 * Source: Kilo-Org/cloud apps/web/src/routers/{models,model-preferences}-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type { CloudModel, ModelPreferences } from './types.ts'

const CloudModelSchema: z.ZodType<CloudModel> = z
  .object({
    id: z.string(),
    name: z.string(),
    supportsVision: z.boolean().optional(),
    isPreferred: z.boolean().optional(),
  })
  .passthrough() as z.ZodType<CloudModel>

const ModelPreferencesSchema: z.ZodType<ModelPreferences> = z
  .object({
    favorites: z.array(z.string()),
    lastSelected: z.object({ model: z.string(), variant: z.string().optional() }).nullish(),
  })
  .passthrough() as z.ZodType<ModelPreferences>

/** models.list — the catalog of models the account may use. */
export async function listModels(token: string): Promise<CloudModel[]> {
  return trpcQuery('models.list', token, z.array(CloudModelSchema))
}

/** models.preferred — ids of the preferred models, in display order. */
export async function listPreferredModels(token: string): Promise<string[]> {
  return trpcQuery('models.preferred', token, z.array(z.string()))
}

/** modelPreferences.get */
export async function getModelPreferences(
  token: string,
  organizationId?: string,
): Promise<ModelPreferences> {
  return trpcQuery('modelPreferences.get', token, ModelPreferencesSchema, { organizationId })
}

/** modelPreferences.setLastSelected — remember the model the user picked. */
export async function setLastSelectedModel(
  token: string,
  model: string,
  variant?: string,
): Promise<void> {
  await trpcMutate('modelPreferences.setLastSelected', token, z.unknown(), { model, variant })
}

/** modelPreferences.clearLastSelected */
export async function clearLastSelectedModel(token: string): Promise<void> {
  await trpcMutate('modelPreferences.clearLastSelected', token, z.unknown(), {})
}

/** modelPreferences.addFavorite */
export async function addFavoriteModel(token: string, model: string): Promise<void> {
  await trpcMutate('modelPreferences.addFavorite', token, z.unknown(), { model })
}

/** modelPreferences.removeFavorite */
export async function removeFavoriteModel(token: string, model: string): Promise<void> {
  await trpcMutate('modelPreferences.removeFavorite', token, z.unknown(), { model })
}

/** modelPreferences.setFavorites — replace the whole favorite list. */
export async function setFavoriteModels(token: string, models: string[]): Promise<void> {
  await trpcMutate('modelPreferences.setFavorites', token, z.unknown(), { models })
}
