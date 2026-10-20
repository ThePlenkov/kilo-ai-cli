/**
 * Todos (task lists) tRPC procedures.
 * Source: Kilo-Org/cloud apps/web/src/routers/todos-router.ts
 */

import { z } from 'zod'
import { trpcMutate, trpcQuery } from './client.ts'
import type { TodoItem, TodoList, TodoUpNextItem } from './types.ts'

// --- Schemas ---

const TodoListSchema: z.ZodType<TodoList> = z
  .object({
    id: z.string(),
    organizationId: z.string().nullish(),
    name: z.string(),
    emoji: z.string().nullish(),
    gitUrl: z.string().nullish(),
    mode: z.string().nullish(),
    model: z.string().nullish(),
    variant: z.string().nullish(),
    position: z.string(),
    archivedAt: z.string().nullish(),
    createdAt: z.string(),
    updatedAt: z.string(),
    openCount: z.number().optional(),
  })
  .passthrough() as z.ZodType<TodoList>

const TodoItemSchema: z.ZodType<TodoItem> = z
  .object({
    id: z.string(),
    listId: z.string(),
    title: z.string(),
    notes: z.string().nullish(),
    doneAt: z.string().nullish(),
    position: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    sessions: z.array(z.unknown()).optional(),
  })
  .passthrough() as z.ZodType<TodoItem>

const TodoUpNextSchema: z.ZodType<TodoUpNextItem> = z
  .object({
    id: z.string(),
    listId: z.string(),
    title: z.string(),
    notes: z.string().nullish(),
    doneAt: z.string().nullish(),
    listName: z.string().optional(),
    listEmoji: z.string().nullish(),
  })
  .passthrough() as z.ZodType<TodoUpNextItem>

// --- Lists ---

/** todos.lists.list — every non-archived list for the scope. */
export async function listTodoLists(
  token: string,
  organizationId?: string,
  includeArchived?: boolean,
): Promise<TodoList[]> {
  return trpcQuery('todos.lists.list', token, z.array(TodoListSchema), {
    organizationId: organizationId ?? null,
    includeArchived,
  })
}

/** todos.lists.create */
export async function createTodoList(
  token: string,
  input: {
    organizationId?: string
    name: string
    emoji?: string
    gitUrl?: string
    mode?: string
    model?: string
    variant?: string
  },
): Promise<TodoList> {
  return trpcMutate('todos.lists.create', token, TodoListSchema, {
    organizationId: input.organizationId ?? null,
    ...input,
  })
}

/** todos.lists.update — at least one field must change. */
export async function updateTodoList(
  token: string,
  input: {
    id: string
    name?: string
    emoji?: string
    gitUrl?: string
    mode?: string
    model?: string
    variant?: string
    archived?: boolean
  },
): Promise<TodoList> {
  return trpcMutate('todos.lists.update', token, TodoListSchema, input)
}

/** todos.lists.move — reposition between two neighbours. */
export async function moveTodoList(
  token: string,
  input: { id: string; beforeId?: string | null; afterId?: string | null },
): Promise<TodoList> {
  return trpcMutate('todos.lists.move', token, TodoListSchema, input)
}

/** todos.lists.delete */
export async function deleteTodoList(token: string, id: string): Promise<void> {
  await trpcMutate('todos.lists.delete', token, z.unknown(), { id })
}

// --- Items ---

/** todos.items.list — items of one list, done items last. */
export async function listTodoItems(token: string, listId: string): Promise<TodoItem[]> {
  return trpcQuery('todos.items.list', token, z.array(TodoItemSchema), { listId })
}

/** todos.items.upNext — the next open items across every list. */
export async function listUpNextTodos(
  token: string,
  organizationId?: string,
  limit?: number,
): Promise<TodoUpNextItem[]> {
  return trpcQuery('todos.items.upNext', token, z.array(TodoUpNextSchema), {
    organizationId: organizationId ?? null,
    limit,
  })
}

/** todos.items.get */
export async function getTodoItem(token: string, id: string): Promise<TodoItem> {
  return trpcQuery('todos.items.get', token, TodoItemSchema, { id })
}

/** todos.items.create */
export async function createTodoItem(
  token: string,
  input: { listId: string; title: string; notes?: string },
): Promise<TodoItem> {
  return trpcMutate('todos.items.create', token, TodoItemSchema, input)
}

/** todos.items.update */
export async function updateTodoItem(
  token: string,
  input: { id: string; title?: string; notes?: string; done?: boolean },
): Promise<TodoItem> {
  return trpcMutate('todos.items.update', token, TodoItemSchema, input)
}

/** todos.items.move */
export async function moveTodoItem(
  token: string,
  input: { id: string; beforeId?: string | null; afterId?: string | null },
): Promise<TodoItem> {
  return trpcMutate('todos.items.move', token, TodoItemSchema, input)
}

/** todos.items.delete */
export async function deleteTodoItem(token: string, id: string): Promise<void> {
  await trpcMutate('todos.items.delete', token, z.unknown(), { id })
}

/** todos.items.linkSession — attach a CLI session to a to-do. */
export async function linkTodoSession(
  token: string,
  input: { id: string; sessionId: string; origin: string },
): Promise<unknown> {
  return trpcMutate('todos.items.linkSession', token, z.unknown(), input)
}

/** todos.items.unlinkSession */
export async function unlinkTodoSession(
  token: string,
  input: { id: string; sessionId: string },
): Promise<unknown> {
  return trpcMutate('todos.items.unlinkSession', token, z.unknown(), input)
}

/** todos.items.forSession — to-dos linked to one session. */
export async function listTodosForSession(token: string, sessionId: string): Promise<TodoItem[]> {
  return trpcQuery('todos.items.forSession', token, z.array(TodoItemSchema), { sessionId })
}
