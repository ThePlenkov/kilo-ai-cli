import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addFavoriteModel,
  getModelPreferences,
  listModels,
  listPreferredModels,
  setFavoriteModels,
  setLastSelectedModel,
} from '../../src/api/models.ts'
import { mockMutationResponse, mockResponse, setupFetchMock } from './helpers.ts'

describe('models API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = setupFetchMock()
  })
  afterEach(() => vi.restoreAllMocks())

  it('listModels calls models.list', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([{ id: 'kilo-auto/free', name: 'Auto Free', supportsVision: false }]),
    )

    const models = await listModels('tok')
    expect(models[0]!.id).toBe('kilo-auto/free')
    expect(fetchMock.mock.calls[0]![0]).toContain('models.list')
  })

  it('listPreferredModels returns the ids in order', async () => {
    fetchMock.mockResolvedValue(mockResponse(['kilo-auto/free', 'anthropic/claude-opus-5.5']))

    const ids = await listPreferredModels('tok')
    expect(ids).toEqual(['kilo-auto/free', 'anthropic/claude-opus-5.5'])
  })

  it('getModelPreferences reads favorites and the last selection', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ favorites: ['kilo-auto/free'], lastSelected: { model: 'kilo-auto/free' } }),
    )

    const prefs = await getModelPreferences('tok')
    expect(prefs.favorites).toEqual(['kilo-auto/free'])
    expect(prefs.lastSelected?.model).toBe('kilo-auto/free')
  })

  it('addFavoriteModel posts the model id', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({}))

    await addFavoriteModel('tok', 'kilo-auto/free')
    const body = JSON.parse((fetchMock.mock.calls[0]![1]?.body as string) ?? '{}')
    expect(body['0'].model).toBe('kilo-auto/free')
  })

  it('setFavorites posts the whole list', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({}))

    await setFavoriteModels('tok', ['a', 'b'])
    const body = JSON.parse((fetchMock.mock.calls[0]![1]?.body as string) ?? '{}')
    expect(body['0'].models).toEqual(['a', 'b'])
  })

  it('setLastSelectedModel posts the model and variant', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({}))

    await setLastSelectedModel('tok', 'kilo-auto/free', 'fast')
    const body = JSON.parse((fetchMock.mock.calls[0]![1]?.body as string) ?? '{}')
    expect(body['0'].variant).toBe('fast')
  })
})
