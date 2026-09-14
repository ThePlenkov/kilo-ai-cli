/**
 * Clean terminal output formatting — no ugly console.table borders.
 */

// Control characters built from char codes — no literals in regexes (Sonar S6324).
const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)
// Strip every ANSI sequence (CSI incl. SGR, OSC incl. hyperlinks, stray ESC)
// and residual C0/C1/DEL characters — remote text must not carry escapes at all
// (SGR conceal mode `ESC[8m` is a real terminal-injection vector). Callers that
// colorize do so via Column.format, applied after sanitization.
const ANSI_ALL = new RegExp(
  `${ESC}\\[[0-?]*[ -/]*[@-~]|${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)|${ESC}.?`,
  'g',
)
const CTRL = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}]`,
  'g',
)

/** Strip all ANSI escape sequences and control characters from remote text. */
export function sanitize(s: string): string {
  return s.replace(ANSI_ALL, '').replace(CTRL, '')
}

/** Pad or truncate a string to a fixed width. */
function pad(str: string, width: number): string {
  if (str.length > width) return str.slice(0, width - 1) + '…'
  return str.padEnd(width)
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
  /**
   * Post-sanitize formatter (colors, hyperlinks). Receives the truncated cell
   * text and the full sanitized value; ANSI it adds is trusted and survives.
   */
  format?: (shown: string, raw: string) => string
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
        const raw = sanitize(String(row[c.key] ?? '-'))
        const shown = raw.length > c.width ? raw.slice(0, c.width - 1) + '…' : raw
        const styled = c.format ? c.format(shown, raw) : shown
        const fill = ' '.repeat(Math.max(0, c.width - shown.length))
        return c.align === 'right' ? fill + styled : styled + fill
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
    console.log(`  ${label}: ${sanitize(String(value))}`)
  }
}

/** Print a summary line with label: value pairs on one line. */
export function printSummary(items: { label: string; value: string | number }[]): void {
  console.log(items.map((i) => `${i.label}: ${i.value}`).join('  |  '))
}
