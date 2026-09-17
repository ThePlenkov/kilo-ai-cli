/** Shared color scheme and formatting — used by both TUI and console output. */

import chalk from 'chalk'

// Force color output even when piped (e.g. through node | cat)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(chalk as any).level = Math.max((chalk as any).level ?? 0, 1)

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

/** Map color name → chalk function. */
function chalkColor(name: string): ((s: string) => string) | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn = (chalk as any)[name]
  return typeof fn === 'function' ? (s: string) => fn.call(chalk, s) : null
}

/** Apply severity color to a string (for console output). */
export function colorSeverity(s: string): string {
  const c = SEVERITY_COLORS[s]
  const fn = c ? chalkColor(c) : null
  return fn ? fn(s) : s
}

/** Apply status color to a string (for console output). */
export function colorStatus(s: string): string {
  const c = STATUS_COLORS[s]
  const fn = c ? chalkColor(c) : null
  return fn ? fn(s) : s
}

/** Apply analysis status color to a string (for console output). */
export function colorAnalysis(s: string): string {
  const c = ANALYSIS_COLORS[s]
  const fn = c ? chalkColor(c) : null
  return fn ? fn(s) : s
}

/**
 * Format a repo full name as a clickable terminal hyperlink (OSC 8).
 * Uses ST terminator (\x1b\\) which is the standard.
 * Shows just the repo name (short), links to the full GitHub URL.
 * Sanitizes control characters to prevent terminal injection.
 * Falls back to plain text if the terminal doesn't support OSC 8.
 */
export function repoLink(repoFullName: string | undefined, label?: string): string {
  // Strip control characters (C0 and C1) to prevent terminal injection
  const c0 = String.fromCharCode(0)
  const c1f = String.fromCharCode(0x1f)
  const del = String.fromCharCode(0x7f)
  const c9f = String.fromCharCode(0x9f)
  const ctrl = new RegExp(`[${c0}-${c1f}${del}-${c9f}]`, 'g')
  const safeLabel = label ? label.replace(ctrl, '') : undefined
  if (!repoFullName || repoFullName === '-') return safeLabel || '-'
  const safe = repoFullName.replace(ctrl, '')
  // Reject path traversal segments before building the URL
  const segments = safe.split('/')
  if (segments.some((s) => s === '.' || s === '..' || s === '')) return safeLabel || safe || '-'
  // URI-encode each path segment separately (preserve / in owner/repo)
  const url = `https://github.com/${segments.map(encodeURIComponent).join('/')}`
  // Check if terminal supports OSC 8 hyperlinks
  if (!supportsHyperlinks()) return safeLabel ?? safe
  // OSC 8 hyperlink: ESC ] 8 ; ; <url> ESC \ <label> ESC ] 8 ; ; ESC \
  const esc = String.fromCharCode(27)
  return `${esc}]8;;${url}${esc}\\${safeLabel ?? safe}${esc}]8;;${esc}\\`
}

/**
 * Detect whether the terminal supports OSC 8 hyperlinks.
 * Defaults to true for TTY — unsupported terminals ignore the sequences
 * and still show the label text. Use FORCE_HYPERLINK=0 to disable.
 */
let _hyperlinkSupport: boolean | null = null
function supportsHyperlinks(): boolean {
  if (_hyperlinkSupport !== null) return _hyperlinkSupport
  if (process.env.FORCE_HYPERLINK) {
    _hyperlinkSupport = process.env.FORCE_HYPERLINK !== '0'
    return _hyperlinkSupport
  }
  _hyperlinkSupport = process.stdout.isTTY === true
  return _hyperlinkSupport
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
