import { fs, vol } from 'memfs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { KiloAuth } from '../../src/api/types.ts'

// Mock the real `node:fs/promises` with memfs' promises implementation so the
// token store reads/writes against an in-memory volume instead of the real
// filesystem.
vi.mock('node:fs/promises', () => fs.promises)

const { createTokenStore } = await import('../../src/auth/token-store.ts')

// Use a virtual filesystem path under memfs. memfs creates a virtual `/` by
// default, so we use absolute paths rooted at `/home/.kilo` for tests.
const CONFIG_DIR = '/home/.kilo'
const CREDENTIALS_PATH = `${CONFIG_DIR}/credentials.json`

beforeEach(() => {
  // Reset memfs to a known empty state before each test.
  vol.reset()
})

afterEach(() => {
  vol.reset()
})

describe('token-store', () => {
  it('get returns undefined when the credentials file does not exist', async () => {
    const store = createTokenStore(CONFIG_DIR)
    const result = await store.get()
    expect(result).toBeUndefined()
  })

  it('set writes valid JSON to the credentials file', async () => {
    const store = createTokenStore(CONFIG_DIR)
    const auth: KiloAuth = { type: 'api', key: 'secret-key-123' }
    await store.set(auth)

    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf8') as string
    const parsed = JSON.parse(raw) as KiloAuth
    expect(parsed).toEqual(auth)
  })

  it('get returns the stored auth after set', async () => {
    const store = createTokenStore(CONFIG_DIR)
    const auth: KiloAuth = {
      type: 'oauth',
      access: 'access-token',
      refresh: 'refresh-token',
      expires: 1234567890,
    }
    await store.set(auth)
    const result = await store.get()
    expect(result).toEqual(auth)
  })

  it('clear removes the credentials file', async () => {
    const store = createTokenStore(CONFIG_DIR)
    const auth: KiloAuth = { type: 'api', key: 'secret-key-123' }
    await store.set(auth)
    expect(fs.existsSync(CREDENTIALS_PATH)).toBe(true)

    await store.clear()
    expect(fs.existsSync(CREDENTIALS_PATH)).toBe(false)
  })

  it('clear does not throw when the file does not exist', async () => {
    const store = createTokenStore(CONFIG_DIR)
    await expect(store.clear()).resolves.toBeUndefined()
  })

  it('set creates the config directory if it does not exist', async () => {
    const nestedDir = `${CONFIG_DIR}/nested/deep`
    const store = createTokenStore(nestedDir)
    expect(fs.existsSync(nestedDir)).toBe(false)

    const auth: KiloAuth = { type: 'api', key: 'secret-key-123' }
    await store.set(auth)

    expect(fs.existsSync(`${nestedDir}/credentials.json`)).toBe(true)
  })
})
