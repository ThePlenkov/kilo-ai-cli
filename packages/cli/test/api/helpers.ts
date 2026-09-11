import { vi } from 'vitest'

/** Mock a tRPC query response (single result). */
export function mockResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: () => Promise.resolve(JSON.stringify({ result: { data: { json: data } } })),
    json: () => Promise.resolve({ result: { data: { json: data } } }),
  } as Response
}

/** Mock a tRPC mutation response (array result). */
export function mockMutationResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: () => Promise.resolve(JSON.stringify([{ result: { data: { json: data } } }])),
    json: () => Promise.resolve([{ result: { data: { json: data } } }]),
  } as Response
}

/** Mock an error response. */
export function mockErrorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: () => Promise.resolve(JSON.stringify({ error: { message } })),
    json: () => Promise.resolve({ error: { message } }),
  } as Response
}

/** Create a fetch mock and install it globally. Returns the mock for per-test setup. */
export function setupFetchMock(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn()
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}
