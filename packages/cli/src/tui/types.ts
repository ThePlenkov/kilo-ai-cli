/** TUI view state and navigation types. */

export type TuiView =
  | 'menu'
  | 'findings'
  | 'finding-detail'
  | 'stats'
  | 'dashboard'

export interface FindingsFilter {
  severity?: string
  status?: string
  repoFullName?: string
  limit: number
  offset: number
}
