/**
 * Clean terminal output formatting — no ugly console.table borders.
 * Supports colored cells via per-column color function.
 */

import chalk from 'chalk'

/** Strip ANSI/OSC escape sequences to get visible string length. */
function visibleLen(str: string): number {
  return str
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\]8;;.*?\x1b\\/g, '')   // OSC 8 hyperlinks (ST-terminated)
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\]8;;[^\x07]*\x07[^\x07]*\x07/g, '') // OSC 8 (BEL-terminated)
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\][^\x07]*\x07/g, '')               // other OSC (BEL)
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;]*m/g, '')                   // SGR color codes
    .length
}

/** Pad or truncate a string to a fixed width (handles escape sequences). */
function pad(str: string, width: number): string {
  const vlen = visibleLen(str)
  if (vlen > width) {
    if (str.includes('\x1b')) return str
    return str.slice(0, width - 1) + '…'
  }
  return str + ' '.repeat(width - vlen)
}

/** Pad or truncate a string, right-aligned. */
function padRight(str: string, width: number): string {
  if (str.length > width) return str.slice(0, width - 1) + '…'
  return str.padStart(width)
}

/** Column definition for table output. */
export interface Column {
  key: string
  label: string
  width: number
  align?: 'left' | 'right'
  /** Optional color function — returns chalk-colored string. */
  color?: (value: string, row: Record<string, unknown>) => string
}

/** Print rows as a clean aligned table — no borders, no index column. */
export function printTable(rows: Record<string, unknown>[], columns: Column[]): void {
  if (rows.length === 0) return

  // Header
  const header = columns
    .map((c) => c.align === 'right' ? padRight(c.label, c.width) : pad(c.label, c.width))
    .join('  ')
  console.log(header)
  console.log(columns.map((c) => '─'.repeat(c.width)).join('  '))

  // Rows
  for (const row of rows) {
    const line = columns
      .map((c) => {
        const raw = String(row[c.key] ?? '-')
        const colored = c.color ? c.color(raw, row) : raw
        return c.align === 'right' ? padRight(colored, c.width) : pad(colored, c.width)
      })
      .join('  ')
    console.log(line)
  }
}

/** Print a single record as key-value pairs. */
export function printRecord(record: Record<string, unknown>, labels?: Record<string, string>): void {
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null) continue
    const label = labels?.[key] ?? key
    console.log(`  ${label}: ${value}`)
  }
}

/** Print a summary line with label: value pairs on one line. */
export function printSummary(items: { label: string; value: string | number }[]): void {
  console.log(items.map((i) => `${i.label}: ${i.value}`).join('  |  '))
}

/** Re-export chalk for color functions in commands. */
export { chalk }
