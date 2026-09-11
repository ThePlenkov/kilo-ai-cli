/** Shared color scheme and formatting — used by both TUI and console output. */

/** Severity → chalk color name. Red is reserved for critical only. */
export const SEVERITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'yellow',
  medium: 'blue',
  low: 'gray',
  info: 'gray',
}

/**
 * Status → chalk color name.
 * "open" is neutral (cyan), NOT red — red means error/critical.
 * "fixed" is green (resolved). "ignored" is gray (dismissed).
 */
export const STATUS_COLORS: Record<string, string> = {
  open: 'cyan',
  fixed: 'green',
  ignored: 'gray',
  dismissed: 'gray',
  in_progress: 'yellow',
  remediated: 'green',
}

/** Analysis status → chalk color name. */
export const ANALYSIS_COLORS: Record<string, string> = {
  completed: 'green',
  failed: 'red',
  pending: 'yellow',
  running: 'yellow',
  queued: 'gray',
}

/**
 * Format a repo full name as a short display name.
 * e.g. "ThePlenkov/gitpod" → "gitpod"
 * In detail views, the full GitHub URL is shown (terminals auto-link it).
 */
export function repoShort(repoFullName: string | undefined): string {
  if (!repoFullName || repoFullName === '-') return '-'
  return repoFullName.split('/').pop() ?? repoFullName
}

/** Get the full GitHub URL for a repo full name. */
export function repoUrl(repoFullName: string | undefined): string {
  if (!repoFullName || repoFullName === '-') return '-'
  return `https://github.com/${repoFullName}`
}

/** Truncate a string to maxLen, adding ellipsis if truncated. */
export function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s
}
