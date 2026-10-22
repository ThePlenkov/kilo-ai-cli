/**
 * Todos CLI command handlers — task lists and their items.
 */

import { defineCommand } from 'citty'

import {
  createTodoItem,
  createTodoList,
  deleteTodoItem,
  deleteTodoList,
  getTodoItem,
  listTodoItems,
  listTodoLists,
  listTodosForSession,
  listUpNextTodos,
  updateTodoItem,
  updateTodoList,
} from '../api/todos.ts'
import { printTable } from './format.ts'
import { getToken, triState } from './helpers.ts'

function printLists(lists: Awaited<ReturnType<typeof listTodoLists>>): void {
  if (lists.length === 0) {
    console.log('No todo lists found.')
    return
  }
  printTable(
    lists.map((l) => ({
      id: l.id,
      name: l.name,
      emoji: l.emoji ?? '-',
      open: l.openCount ?? 0,
      repo: l.gitUrl ?? '-',
      updated: l.updatedAt,
    })),
    [
      { key: 'id', label: 'ID', width: 36 },
      { key: 'name', label: 'Name', width: 28 },
      { key: 'emoji', label: 'Emoji', width: 6 },
      { key: 'open', label: 'Open', width: 6, align: 'right' },
      { key: 'repo', label: 'Repository', width: 40 },
      { key: 'updated', label: 'Updated', width: 24 },
    ],
  )
}

function printItems(items: Awaited<ReturnType<typeof listTodoItems>>): void {
  if (items.length === 0) {
    console.log('No todo items found.')
    return
  }
  printTable(
    items.map((i) => ({
      id: i.id,
      title: i.title,
      done: i.doneAt ? 'yes' : 'no',
      notes: i.notes ?? '-',
    })),
    [
      { key: 'id', label: 'ID', width: 36 },
      { key: 'title', label: 'Title', width: 48 },
      { key: 'done', label: 'Done', width: 6 },
      { key: 'notes', label: 'Notes', width: 32 },
    ],
  )
}

export const todosListsCommand = defineCommand({
  meta: { name: 'lists', description: 'List todo lists' },
  args: {
    org: { type: 'string', description: 'Organization ID' },
    archived: { type: 'boolean', description: 'Include archived lists' },
  },
  async run({ args }) {
    const { token } = await getToken()
    printLists(await listTodoLists(token, args.org, args.archived))
  },
})

export const todosCreateListCommand = defineCommand({
  meta: { name: 'create-list', description: 'Create a todo list' },
  args: {
    name: { type: 'positional', description: 'List name', required: true },
    org: { type: 'string', description: 'Organization ID' },
    emoji: { type: 'string', description: 'List emoji' },
    gitUrl: { type: 'string', description: 'Bound repository URL' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const list = await createTodoList(token, {
      name: args.name,
      organizationId: args.org,
      emoji: args.emoji,
      gitUrl: args.gitUrl,
    })
    console.log(`Created list ${list.id} (${list.name})`)
  },
})

export const todosUpdateListCommand = defineCommand({
  meta: { name: 'update-list', description: 'Update a todo list' },
  args: {
    id: { type: 'positional', description: 'List ID', required: true },
    name: { type: 'string', description: 'New name' },
    emoji: { type: 'string', description: 'New emoji' },
    gitUrl: { type: 'string', description: 'New repository URL' },
    archive: { type: 'boolean', description: 'Archive the list' },
    unarchive: { type: 'boolean', description: 'Unarchive the list' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const archived = triState(args.archive, args.unarchive, "'--archive' and '--unarchive'")
    const list = await updateTodoList(token, {
      id: args.id,
      name: args.name,
      emoji: args.emoji,
      gitUrl: args.gitUrl,
      archived,
    })
    console.log(`Updated list ${list.id} (${list.name})`)
  },
})

export const todosDeleteListCommand = defineCommand({
  meta: { name: 'delete-list', description: 'Delete a todo list' },
  args: { id: { type: 'positional', description: 'List ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await deleteTodoList(token, args.id)
    console.log(`Deleted list ${args.id}`)
  },
})

export const todosItemsCommand = defineCommand({
  meta: { name: 'items', description: 'List the items of a todo list' },
  args: { listId: { type: 'positional', description: 'List ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    printItems(await listTodoItems(token, args.listId))
  },
})

export const todosUpNextCommand = defineCommand({
  meta: { name: 'up-next', description: 'Show the next open todo items' },
  args: {
    org: { type: 'string', description: 'Organization ID' },
    limit: { type: 'string', description: 'Max items (1-10)', default: '5' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const items = await listUpNextTodos(token, args.org, Number.parseInt(args.limit, 10) || 5)
    if (items.length === 0) {
      console.log('Nothing up next.')
      return
    }
    printTable(
      items.map((i) => ({
        id: i.id,
        title: i.title,
        list: i.listName ?? '-',
        notes: i.notes ?? '-',
      })),
      [
        { key: 'id', label: 'ID', width: 36 },
        { key: 'title', label: 'Title', width: 44 },
        { key: 'list', label: 'List', width: 24 },
        { key: 'notes', label: 'Notes', width: 24 },
      ],
    )
  },
})

export const todosCreateItemCommand = defineCommand({
  meta: { name: 'create-item', description: 'Create a todo item' },
  args: {
    listId: { type: 'positional', description: 'List ID', required: true },
    title: { type: 'positional', description: 'Item title', required: true },
    notes: { type: 'string', description: 'Item notes' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const item = await createTodoItem(token, {
      listId: args.listId,
      title: args.title,
      notes: args.notes,
    })
    console.log(`Created todo ${item.id} (${item.title})`)
  },
})

export const todosUpdateItemCommand = defineCommand({
  meta: { name: 'update-item', description: 'Update a todo item' },
  args: {
    id: { type: 'positional', description: 'Item ID', required: true },
    title: { type: 'string', description: 'New title' },
    notes: { type: 'string', description: 'New notes' },
    done: { type: 'boolean', description: 'Mark as done' },
    undone: { type: 'boolean', description: 'Mark as not done' },
  },
  async run({ args }) {
    const { token } = await getToken()
    const done = triState(args.done, args.undone, "'--done' and '--undone'")
    const item = await updateTodoItem(token, {
      id: args.id,
      title: args.title,
      notes: args.notes,
      done,
    })
    console.log(`Updated todo ${item.id} (${item.title})`)
  },
})

export const todosGetItemCommand = defineCommand({
  meta: { name: 'get-item', description: 'Get one todo item' },
  args: { id: { type: 'positional', description: 'Item ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    const item = await getTodoItem(token, args.id)
    console.log(`  id: ${item.id}`)
    console.log(`  list: ${item.listId}`)
    console.log(`  title: ${item.title}`)
    console.log(`  notes: ${item.notes ?? '-'}`)
    console.log(`  done: ${item.doneAt ?? 'no'}`)
  },
})

export const todosDeleteItemCommand = defineCommand({
  meta: { name: 'delete-item', description: 'Delete a todo item' },
  args: { id: { type: 'positional', description: 'Item ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    await deleteTodoItem(token, args.id)
    console.log(`Deleted todo ${args.id}`)
  },
})

export const todosForSessionCommand = defineCommand({
  meta: { name: 'for-session', description: 'List the todos linked to a session' },
  args: { sessionId: { type: 'positional', description: 'Session ID', required: true } },
  async run({ args }) {
    const { token } = await getToken()
    printItems(await listTodosForSession(token, args.sessionId))
  },
})
