import { beforeEach, describe, expect, it, vi } from 'vitest'

import { captureConsole, runCommand } from './helpers.ts'

// The commands under test — the ones with logic of their own (flag
// translation, argument validation, output shaping).
const todosApi = vi.hoisted(() => ({
  listTodoLists: vi.fn(),
  listTodoItems: vi.fn(),
  listUpNextTodos: vi.fn(),
  updateTodoItem: vi.fn(),
  createTodoItem: vi.fn(),
}))

const accountApi = vi.hoisted(() => ({
  getBalance: vi.fn(),
  getContextBalance: vi.fn(),
  listDeviceSessions: vi.fn(),
  getNotificationPreferences: vi.fn(),
  setNotificationPreferences: vi.fn(),
  getAutoTopUpPaymentMethod: vi.fn(),
  updateAutoTopUpAmount: vi.fn(),
}))

const integrationsApi = vi.hoisted(() => ({
  listIntegrationStatus: vi.fn(),
  getGitHubInstallation: vi.fn(),
  getGitLabInstallation: vi.fn(),
}))

const webhooksApi = vi.hoisted(() => ({
  listWebhookTriggers: vi.fn(),
  updateWebhookTrigger: vi.fn(),
}))

const deploymentsApi = vi.hoisted(() => ({
  listDeployments: vi.fn(),
}))

vi.mock('../../src/api/todos.ts', () => todosApi)
vi.mock('../../src/api/account.ts', () => accountApi)
vi.mock('../../src/api/integrations.ts', () => integrationsApi)
vi.mock('../../src/api/webhooks.ts', () => webhooksApi)
vi.mock('../../src/api/deployments.ts', () => deploymentsApi)
vi.mock('../../src/commands/helpers.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/commands/helpers.ts')>()),
  getToken: async () => ({ token: 'tok', organizationId: undefined }),
}))

const { todosUpdateItemCommand, todosUpNextCommand } = await import('../../src/commands/todos.ts')
const { accountTopUpCommand, accountSetNotificationsCommand, accountDevicesCommand } = await import(
  '../../src/commands/account.ts'
)
const { integrationsDetailCommand } = await import('../../src/commands/integrations.ts')
const { webhooksUpdateCommand } = await import('../../src/commands/webhooks.ts')
const { deploymentsListCommand } = await import('../../src/commands/deployments.ts')

describe('command layer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('todos', () => {
    it('update-item translates --done/--undone into the done flag', async () => {
      todosApi.updateTodoItem.mockResolvedValue({
        id: 'i1',
        listId: 'l1',
        title: 'Ship it',
        doneAt: '2026-10-20T12:00:00Z',
      })

      await runCommand(todosUpdateItemCommand, { id: 'i1', done: true })

      expect(todosApi.updateTodoItem).toHaveBeenCalledWith('tok', {
        id: 'i1',
        done: true,
      })
    })

    it('update-item leaves the flag alone when neither is given', async () => {
      todosApi.updateTodoItem.mockResolvedValue({ id: 'i1', listId: 'l1', title: 'x' })

      await runCommand(todosUpdateItemCommand, { id: 'i1' })

      expect(todosApi.updateTodoItem).toHaveBeenCalledWith('tok', { id: 'i1' })
    })

    it('up-next lists the next open items', async () => {
      todosApi.listUpNextTodos.mockResolvedValue([
        { id: 'i1', listId: 'l1', title: 'Next thing', listName: 'Backlog' },
      ])

      const capture = captureConsole()
      await runCommand(todosUpNextCommand, { limit: '3' })
      capture.restore()

      expect(todosApi.listUpNextTodos).toHaveBeenCalledWith('tok', undefined, 3)
      expect(capture.lines.join('\n')).toContain('Next thing')
    })
  })

  describe('account', () => {
    it('top-up refuses a fractional amount instead of rounding it', async () => {
      await expect(runCommand(accountTopUpCommand, { amount: '12.5' })).rejects.toThrow(
        /whole number of cents/,
      )

      expect(accountApi.updateAutoTopUpAmount).not.toHaveBeenCalled()
    })

    it('top-up refuses a non-numeric amount', async () => {
      await expect(runCommand(accountTopUpCommand, { amount: '12oops' })).rejects.toThrow(
        /whole number of cents/,
      )
    })

    it('top-up passes a whole amount through', async () => {
      accountApi.updateAutoTopUpAmount.mockResolvedValue(undefined)

      await runCommand(accountTopUpCommand, { amount: '1200' })

      expect(accountApi.updateAutoTopUpAmount).toHaveBeenCalledWith('tok', 1200)
    })

    it('set-notifications maps the flags to the API names', async () => {
      accountApi.setNotificationPreferences.mockResolvedValue(undefined)

      await runCommand(accountSetNotificationsCommand, {
        'chat-messages': true,
        'security-findings': false,
      })

      expect(accountApi.setNotificationPreferences).toHaveBeenCalledWith('tok', {
        chatMessages: true,
        securityFindings: false,
      })
    })

    it('set-notifications refuses an empty change', async () => {
      await expect(runCommand(accountSetNotificationsCommand, {})).rejects.toThrow(
        /at least one preference/,
      )
      expect(accountApi.setNotificationPreferences).not.toHaveBeenCalled()
    })

    it('devices reads the snake_case field the API returns', async () => {
      accountApi.listDeviceSessions.mockResolvedValue([
        { id: 'd1', user_agent: 'kilo-ai-cli/1.0', last_seen_at: '2026-10-20T12:00:00Z' },
      ])

      const capture = captureConsole()
      await runCommand(accountDevicesCommand, {})
      capture.restore()

      expect(capture.lines.join('\n')).toContain('kilo-ai-cli/1.0')
    })
  })

  describe('integrations', () => {
    it('detail refuses a GitHub lookup without an installation id', async () => {
      await expect(runCommand(integrationsDetailCommand, { platform: 'github' })).rejects.toThrow(
        /installation id/,
      )
      expect(integrationsApi.getGitHubInstallation).not.toHaveBeenCalled()
    })

    it('detail passes the installation id to the API', async () => {
      integrationsApi.getGitHubInstallation.mockResolvedValue({ accountLogin: 'me' })

      await runCommand(integrationsDetailCommand, { platform: 'github', id: 'inst-1' })

      expect(integrationsApi.getGitHubInstallation).toHaveBeenCalledWith('tok', 'inst-1')
    })
  })

  describe('webhooks', () => {
    it('update can re-enable a trigger, not only disable it', async () => {
      webhooksApi.updateWebhookTrigger.mockResolvedValue({ id: 'w1' })

      await runCommand(webhooksUpdateCommand, { id: 'w1', enable: true })

      expect(webhooksApi.updateWebhookTrigger).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({ id: 'w1', enabled: true }),
      )
    })

    it('update leaves the enabled flag alone when neither flag is given', async () => {
      webhooksApi.updateWebhookTrigger.mockResolvedValue({ id: 'w1' })

      await runCommand(webhooksUpdateCommand, { id: 'w1', prompt: 'new prompt' })

      // The command maps `--prompt` onto the API's `promptTemplate` field.
      expect(webhooksApi.updateWebhookTrigger).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({ id: 'w1', promptTemplate: 'new prompt' }),
      )
      const call = webhooksApi.updateWebhookTrigger.mock.calls[0]![1] as Record<string, unknown>
      expect(call.enabled).toBeUndefined()
    })
  })

  describe('deployments', () => {
    it('list renders the fields as text rather than [object Object]', async () => {
      deploymentsApi.listDeployments.mockResolvedValue([
        { id: 'd1', name: 'my app', slug: 'my-app', status: 'deployed', url: 'https://x' },
      ])

      const capture = captureConsole()
      await runCommand(deploymentsListCommand, {})
      capture.restore()

      const output = capture.lines.join('\n')
      expect(output).toContain('my app')
      expect(output).not.toContain('[object Object]')
    })
  })
})
