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
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value)
      // A value JSON cannot represent (undefined, a function) falls back to
      // its tag — `String(value)` would print "[object Object]".
      return json === undefined ? Object.prototype.toString.call(value) : json
    } catch {
      // Circular structures cannot be serialized either — fall back to the tag.
      return Object.prototype.toString.call(value)
    }
  }
  // Symbols, bigints and functions.
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
