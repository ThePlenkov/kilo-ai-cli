import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  checkAppBuilderEligibility,
  deployAppBuilderProject,
  listAppBuilderProjects,
} from '../../src/api/app-builder.ts'
import { mockMutationResponse, mockResponse, setupFetchMock } from './helpers.ts'

describe('app-builder API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = setupFetchMock()
  })
  afterEach(() => vi.restoreAllMocks())

  it('listAppBuilderProjects calls appBuilder.listProjects', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([
        {
          id: 'p1',
          name: 'My App',
          status: 'deployed',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-02',
        },
      ]),
    )
    const result = await listAppBuilderProjects('tok')
    expect(result).toHaveLength(1)
    expect(fetchMock.mock.calls[0]![0]).toContain('appBuilder.listProjects')
  })

  it('checkAppBuilderEligibility calls appBuilder.checkEligibility', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ isEligible: true, balance: 10.35, minBalance: 1, accessLevel: 'full' }),
    )
    const result = await checkAppBuilderEligibility('tok')
    expect(result.isEligible).toBe(true)
    expect(fetchMock.mock.calls[0]![0]).toContain('appBuilder.checkEligibility')
  })

  it('deployAppBuilderProject posts with projectId', async () => {
    fetchMock.mockResolvedValue(
      mockMutationResponse({
        id: 'p1',
        name: 'My App',
        status: 'deploying',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      }),
    )
    const result = await deployAppBuilderProject('tok', 'p1')
    expect(result.status).toBe('deploying')
    const init = fetchMock.mock.calls[0]![1] as { body: string }
    expect(JSON.parse(init.body)).toEqual({ '0': { projectId: 'p1' } })
  })
})
