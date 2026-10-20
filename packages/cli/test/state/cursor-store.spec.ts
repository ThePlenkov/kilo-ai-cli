import { fs, vol } from 'memfs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the real `node:fs/promises` with memfs' promises implementation so the
// cursor store reads/writes against an in-memory volume.
vi.mock('node:fs/promises', () => fs.promises)

const { createCursorStore } = await import('../../src/state/cursor-store.ts')

const CONFIG_DIR = '/home/.kilo'
const CURSORS_PATH = `${CONFIG_DIR}/cursors.json`

beforeEach(() => {
  vol.reset()
})

afterEach(() => {
  vol.reset()
})

describe('cursor-store', () => {
  it('get returns undefined when the cursor file does not exist', async () => {
    const store = createCursorStore(CONFIG_DIR)
    expect(await store.get('reviews')).toBeUndefined()
  })

  it('set writes the cursor and get reads it back', async () => {
    const store = createCursorStore(CONFIG_DIR)
    const entry = await store.set('reviews', '2026-10-20T12:00:00.000Z')

    expect(entry.value).toBe('2026-10-20T12:00:00.000Z')
    expect(entry.updatedAt).not.toBe('')

    const stored = await store.get('reviews')
    expect(stored?.value).toBe('2026-10-20T12:00:00.000Z')
  })

  it('persists cursors across store instances', async () => {
    await createCursorStore(CONFIG_DIR).set('sessions', '2026-10-20T11:00:00.000Z')
    const second = createCursorStore(CONFIG_DIR)
    expect((await second.get('sessions'))?.value).toBe('2026-10-20T11:00:00.000Z')
  })

  it('list returns every stored cursor', async () => {
    const store = createCursorStore(CONFIG_DIR)
    await store.set('reviews', 'a')
    await store.set('sessions', 'b')

    const cursors = await store.list()
    expect(Object.keys(cursors).sort()).toEqual(['reviews', 'sessions'])
    expect(cursors.reviews?.value).toBe('a')
  })

  it('remove deletes only the named cursor', async () => {
    const store = createCursorStore(CONFIG_DIR)
    await store.set('reviews', 'a')
    await store.set('sessions', 'b')

    await store.remove('reviews')

    expect(await store.get('reviews')).toBeUndefined()
    expect((await store.get('sessions'))?.value).toBe('b')
  })

  it('remove on a missing cursor is a no-op', async () => {
    const store = createCursorStore(CONFIG_DIR)
    await expect(store.remove('nope')).resolves.toBeUndefined()
    expect(fs.existsSync(CURSORS_PATH)).toBe(false)
  })

  it('clear removes every cursor', async () => {
    const store = createCursorStore(CONFIG_DIR)
    await store.set('reviews', 'a')
    await store.clear()
    expect(Object.keys(await store.list())).toEqual([])
  })

  it('tolerates a corrupt cursor file', async () => {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.writeFileSync(CURSORS_PATH, '{not json')

    const store = createCursorStore(CONFIG_DIR)
    expect(await store.get('reviews')).toBeUndefined()
    // The corrupt file is replaced by a valid one on the next write.
    await store.set('reviews', 'a')
    expect((await store.get('reviews'))?.value).toBe('a')
  })

  it('keeps both writes when two stores update different cursors concurrently', async () => {
    const first = createCursorStore(CONFIG_DIR)
    const second = createCursorStore(CONFIG_DIR)

    await Promise.all([first.set('reviews', 'a'), second.set('sessions', 'b')])

    const cursors = await createCursorStore(CONFIG_DIR).list()
    expect(cursors.reviews?.value).toBe('a')
    expect(cursors.sessions?.value).toBe('b')
  })

  it('leaves no lock file behind', async () => {
    const store = createCursorStore(CONFIG_DIR)
    await store.set('reviews', 'a')
    expect(fs.existsSync(`${CURSORS_PATH}.lock`)).toBe(false)
  })

  it('writes the file atomically, so a crash cannot truncate it', async () => {
    const store = createCursorStore(CONFIG_DIR)
    await store.set('reviews', 'a')
    await store.set('sessions', 'b')

    const raw = fs.readFileSync(CURSORS_PATH, 'utf8') as string
    expect(() => JSON.parse(raw)).not.toThrow()
    expect(raw.endsWith('\n')).toBe(true)
  })

  it('ignores entries without a value', async () => {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.writeFileSync(
      CURSORS_PATH,
      JSON.stringify({ version: 1, cursors: { broken: { updatedAt: 'x' }, good: { value: 'v' } } }),
    )

    const store = createCursorStore(CONFIG_DIR)
    expect(await store.get('broken')).toBeUndefined()
    expect((await store.get('good'))?.value).toBe('v')
  })
})
