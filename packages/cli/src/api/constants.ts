/**
 * Kilo API configuration constants.
 * Mirrors @kilocode/kilo-gateway/src/api/constants.ts
 */

/** Environment variable for custom Kilo API URL */
export const ENV_KILO_API_URL = 'KILO_API_URL'

/** Default Kilo API URL */
export const DEFAULT_KILO_API_URL = 'https://api.kilo.ai'

/** Base URL for Kilo API — can be overridden by KILO_API_URL env var */
export const KILO_API_BASE: string = process.env[ENV_KILO_API_URL] || DEFAULT_KILO_API_URL

/** Environment variable for custom session ingest URL */
export const ENV_KILO_SESSION_INGEST_URL = 'KILO_SESSION_INGEST_URL'

/** Default session ingest URL */
export const DEFAULT_KILO_SESSION_INGEST_URL = 'https://ingest.kilosessions.ai'

/** Base URL for session ingest — can be overridden by KILO_SESSION_INGEST_URL env var */
export const KILO_SESSION_INGEST_BASE: string =
  process.env[ENV_KILO_SESSION_INGEST_URL] || DEFAULT_KILO_SESSION_INGEST_URL

/** Device auth polling interval in milliseconds */
export const POLL_INTERVAL_MS = 3000

/** Default model for authenticated users */
export const DEFAULT_MODEL = 'kilo-auto/balanced'

/** Default model for anonymous/free usage */
export const DEFAULT_FREE_MODEL = 'kilo-auto/free'

/** Token expiration duration in milliseconds (1 year) */
export const TOKEN_EXPIRATION_MS = 365 * 24 * 60 * 60 * 1000

/** User-Agent header base value */
export const USER_AGENT_BASE = 'kilo-ai-cli'

/** Content-Type header value */
export const CONTENT_TYPE = 'application/json'

/** Default editor name */
export const DEFAULT_EDITOR_NAME = 'kilo-ai-cli'

/** Environment variable for version */
export const ENV_VERSION = 'KILO_CLI_VERSION'

/** Header constants for KiloCode API requests */
export const HEADER_ORGANIZATIONID = 'X-KILOCODE-ORGANIZATIONID'
export const HEADER_EDITORNAME = 'X-KILOCODE-EDITORNAME'
export const HEADER_TASKID = 'X-KILOCODE-TASKID'
export const HEADER_PROJECTID = 'X-KILOCODE-PROJECTID'
export const HEADER_MACHINEID = 'X-KILOCODE-MACHINEID'
export const HEADER_TESTER = 'X-KILOCODE-TESTER'
export const HEADER_FEATURE = 'X-KILOCODE-FEATURE'
