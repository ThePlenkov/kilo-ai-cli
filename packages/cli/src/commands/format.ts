/**
 * Clean terminal output formatting — no ugly console.table borders.
 */

// Control characters built from char codes — no literals in regexes (Sonar S6324).
const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)
// Keep SGR color codes (our own chalk output); strip OSC hyperlinks, other CSI
// sequences (cursor moves, clears), stray ESCs, then residual C0/C1/DEL chars.
const UNSAFE_ANSI = new RegExp(
  `(${ESC}\\[[0-9;:]*m)` +
    `|${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)` +
    `|${ESC}\\[[0-9;:]*[A-Za-z]` +
    `|${ESC}.?`,
  'g',
)
const CTRL = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(26)}${String.fromCharCode(28)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}]`,
  'g',
)

/** Strip dangerous control characters/sequences from remote text; SGR colors survive. */
export function sanitize(s: string): string {
  return s.replace(UNSAFE_ANSI, (_m, sgr: string | undefined) => sgr ?? '').replace(CTRL, '')
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
        const val = sanitize(String(row[c.key] ?? '-'))
        return c.align === 'right' ? padRight(val, c.width) : pad(val, c.width)
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
