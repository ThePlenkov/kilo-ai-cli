import React from 'react'

import { listTodoItems, listTodoLists, listUpNextTodos } from '../../api/todos.ts'
import type { TodoItem, TodoList, TodoUpNextItem } from '../../api/types.ts'
import { QueryListScreen } from '../components.tsx'
import type { ScreenProps } from '../types.ts'

/** Cloud → Todos: the todo lists of the account. */
export function TodosScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<TodoList>
      focused={focused}
      fetch={() => listTodoLists(ctx.token, ctx.organizationId)}
      columns={[
        { label: 'Name', width: 28, value: (l) => l.name },
        { label: 'Open', width: 6, align: 'right', value: (l) => String(l.openCount ?? 0) },
        { label: 'Repository', width: 40, value: (l) => l.gitUrl ?? '-' },
        { label: 'Updated', width: 20, value: (l) => l.updatedAt.slice(0, 16).replace('T', ' ') },
      ]}
      onSelect={(l) => ctx.navigate('todo-items', { id: l.id })}
      onBack={ctx.goBack}
      emptyText="No todo lists."
    />
  )
}

/** Cloud → Todos → list: the items of one todo list. */
export function TodoItemsScreen({ ctx, focused }: ScreenProps) {
  const listId = ctx.route.params.id ?? ''
  return (
    <QueryListScreen<TodoItem>
      focused={focused}
      fetch={() => listTodoItems(ctx.token, listId)}
      columns={[
        { label: 'Title', width: 48, value: (i) => i.title },
        {
          label: 'Done',
          width: 6,
          value: (i) => (i.doneAt ? 'yes' : 'no'),
          color: (i) => (i.doneAt ? 'green' : 'gray'),
        },
        { label: 'Notes', width: 30, value: (i) => i.notes ?? '-' },
      ]}
      onBack={ctx.goBack}
      emptyText="No todo items."
    />
  )
}

/** Cloud → Todos → up next: the next open items across every list. */
export function UpNextScreen({ ctx, focused }: ScreenProps) {
  return (
    <QueryListScreen<TodoUpNextItem>
      focused={focused}
      fetch={() => listUpNextTodos(ctx.token, ctx.organizationId, 10)}
      columns={[
        { label: 'Title', width: 44, value: (i) => i.title },
        { label: 'List', width: 24, value: (i) => i.listName ?? i.listId },
      ]}
      onBack={ctx.goBack}
      emptyText="Nothing up next."
    />
  )
}
