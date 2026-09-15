/**
 * Build KiloCode-specific headers for API requests.
 * Mirrors @kilocode/kilo-gateway/src/headers.ts
 */

import pkg from '../../package.json' with { type: 'json' }
import {
  CONTENT_TYPE,
  DEFAULT_EDITOR_NAME,
  ENV_VERSION,
  HEADER_EDITORNAME,
  HEADER_MACHINEID,
  HEADER_ORGANIZATIONID,
  HEADER_PROJECTID,
  HEADER_TASKID,
  USER_AGENT_BASE,
} from './constants.ts'

function cliVersion(): string {
  return process.env[ENV_VERSION] || pkg.version
}

export function getUserAgent(): string {
  return `${USER_AGENT_BASE}/${cliVersion()}`
}

export function getEditorNameHeader(): string {
  return `${DEFAULT_EDITOR_NAME} ${cliVersion()}`
}

export function getDefaultHeaders(): Record<string, string> {
  return {
    'User-Agent': getUserAgent(),
    'Content-Type': CONTENT_TYPE,
  }
}

export interface KiloHeaderMetadata {
  taskId?: string
  projectId?: string
}

export interface KiloHeaderOptions {
  kilocodeOrganizationId?: string
  machineId?: string
}

/**
 * Build KiloCode-specific headers from metadata and options.
 * Always includes editor name. Adds org/task/project/machine headers when provided.
 */
export function buildKiloHeaders(
  metadata?: KiloHeaderMetadata,
  options?: KiloHeaderOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    [HEADER_EDITORNAME]: getEditorNameHeader(),
  }

  if (metadata?.taskId) {
    headers[HEADER_TASKID] = metadata.taskId
  }

  if (options?.kilocodeOrganizationId) {
    headers[HEADER_ORGANIZATIONID] = options.kilocodeOrganizationId

    if (metadata?.projectId) {
      headers[HEADER_PROJECTID] = metadata.projectId
    }
  }

  if (options?.machineId) {
    headers[HEADER_MACHINEID] = options.machineId
  }

  return headers
}

/**
 * Build auth headers for a Bearer token.
 */
export function buildAuthHeaders(
  token: string,
  metadata?: KiloHeaderMetadata,
  options?: KiloHeaderOptions,
): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...buildKiloHeaders(metadata, options),
  }
}
