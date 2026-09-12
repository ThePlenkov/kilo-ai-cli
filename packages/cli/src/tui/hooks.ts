import { useCallback, useEffect, useRef, useState } from 'react'

export interface QueryState<T> {
  data: T | undefined
  error: string | undefined
  loading: boolean
  reload: () => void
}

/**
 * Minimal data-fetching hook: runs `fn` on mount and when deps change,
 * guards against stale responses, exposes reload() for manual refresh.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: readonly unknown[] = []): QueryState<T> {
  const [state, setState] = useState<{ data: T | undefined; error: string | undefined; loading: boolean }>({
    data: undefined,
    error: undefined,
    loading: true,
  })
  const seq = useRef(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(() => {
    const s = ++seq.current
    setState((p) => ({ ...p, loading: true, error: undefined }))
    fnRef.current().then(
      (data) => {
        if (s === seq.current) setState({ data, error: undefined, loading: false })
      },
      (e) => {
        if (s === seq.current) {
          setState({ data: undefined, error: e instanceof Error ? e.message : String(e), loading: false })
        }
      },
    )
  }, deps)

  useEffect(() => {
    reload()
  }, [reload])

  return { ...state, reload }
}
