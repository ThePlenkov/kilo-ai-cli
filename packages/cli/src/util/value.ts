/**
 * Value rendering shared by the CLI output and the TUI.
 */

/**
 * Render an unknown value for display: objects and arrays as JSON, scalars
 * as text. `String(value)` would print "[object Object]" for an object.
 */
export function stringifyValue(value: unknown): string {
  if (value === undefined) return ''
  if (value === null) return 'null'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value) ?? String(value)
    } catch {
      // Circular structures cannot be serialized — fall back to the tag.
      return Object.prototype.toString.call(value)
    }
  }
  return String(value)
}

/**
 * Render an optional boolean. An absent value is reported as `absent` (not
 * "no") — an unknown flag must not read as a false one.
 */
export function yesNo(value: boolean | null | undefined, absent = '-'): string {
  if (value == null) return absent
  return value ? 'yes' : 'no'
}
