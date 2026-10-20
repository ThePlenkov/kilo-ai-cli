import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createTodoItem,
  createTodoList,
  deleteTodoItem,
  listTodoItems,
  listTodoLists,
  listUpNextTodos,
  updateTodoItem,
} from '../../src/api/todos.ts'
import { mockMutationResponse, mockResponse, setupFetchMock } from './helpers.ts'

describe('todos API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = setupFetchMock()
  })
  afterEach(() => vi.restoreAllMocks())

  it('listTodoLists calls todos.lists.list with a null organization scope', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([
        {
          id: 'l1',
          organizationId: null,
          name: 'Backlog',
          position: 'a',
          createdAt: '2026-10-20T10:00:00Z',
          updatedAt: '2026-10-20T10:00:00Z',
          openCount: 2,
        },
      ]),
    )

    const lists = await listTodoLists('tok')
    expect(lists).toHaveLength(1)
    expect(lists[0]!.name).toBe('Backlog')

    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('todos.lists.list')
    expect(decodeURIComponent(url.split('input=')[1]!)).toContain('"organizationId":null')
  })

  it('listTodoItems calls todos.items.list with the list id', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([{ id: 'i1', listId: 'l1', title: 'Ship it', doneAt: null }]),
    )

    const items = await listTodoItems('tok', 'l1')
    expect(items[0]!.title).toBe('Ship it')
    expect(fetchMock.mock.calls[0]![0]).toContain('todos.items.list')
  })

  it('listUpNextTodos calls todos.items.upNext', async () => {
    fetchMock.mockResolvedValue(
      mockResponse([{ id: 'i1', listId: 'l1', title: 'Next', listName: 'Backlog' }]),
    )

    const items = await listUpNextTodos('tok', undefined, 5)
    expect(items[0]!.listName).toBe('Backlog')
    expect(fetchMock.mock.calls[0]![0]).toContain('todos.items.upNext')
  })

  it('createTodoList posts to todos.lists.create', async () => {
    fetchMock.mockResolvedValue(
      mockMutationResponse({
        id: 'l2',
        name: 'Ideas',
        position: 'b',
        createdAt: '2026-10-20T10:00:00Z',
        updatedAt: '2026-10-20T10:00:00Z',
      }),
    )

    const list = await createTodoList('tok', { name: 'Ideas' })
    expect(list.id).toBe('l2')
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('todos.lists.create')
    expect(fetchMock.mock.calls[0]![1]?.method).toBe('POST')
  })

  it('createTodoItem posts to todos.items.create', async () => {
    fetchMock.mockResolvedValue(
      mockMutationResponse({ id: 'i2', listId: 'l1', title: 'Write docs' }),
    )

    const item = await createTodoItem('tok', { listId: 'l1', title: 'Write docs' })
    expect(item.title).toBe('Write docs')
    expect(fetchMock.mock.calls[0]![0]).toContain('todos.items.create')
  })

  it('updateTodoItem passes the done flag', async () => {
    fetchMock.mockResolvedValue(
      mockMutationResponse({
        id: 'i1',
        listId: 'l1',
        title: 'Done',
        doneAt: '2026-10-20T11:00:00Z',
      }),
    )

    await updateTodoItem('tok', { id: 'i1', done: true })
    const body = JSON.parse((fetchMock.mock.calls[0]![1]?.body as string) ?? '{}')
    expect(body['0'].done).toBe(true)
  })

  it('deleteTodoItem posts the id', async () => {
    fetchMock.mockResolvedValue(mockMutationResponse({ id: 'i1' }))

    await deleteTodoItem('tok', 'i1')
    const body = JSON.parse((fetchMock.mock.calls[0]![1]?.body as string) ?? '{}')
    expect(body['0'].id).toBe('i1')
  })
})
