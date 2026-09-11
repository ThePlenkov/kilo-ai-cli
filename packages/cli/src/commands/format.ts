/**
 * Clean terminal output formatting — no ugly console.table borders.
 */

/** Pad or truncate a string to a fixed width. */
function pad(str: string, width: number): string {
  if (str.length > width) return str.slice(0, width - 1) + '…'
  return str.padEnd(width)
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
    .map((c) => c.align === 'right' ? pad(c.label, c.width).padStart(c.width) : pad(c.label, c.width))
    .join('  ')
  console.log(header)
  console.log(columns.map((c) => '─'.repeat(c.width)).join('  '))

  // Rows
  for (const row of rows) {
    const line = columns
      .map((c) => {
        const val = String(row[c.key] ?? '-')
        return c.align === 'right' ? pad(val, c.width).padStart(c.width) : pad(val, c.width)
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
