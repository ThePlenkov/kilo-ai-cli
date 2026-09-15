import { useStdout } from 'ink'
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
  const [state, setState] = useState<{
    data: T | undefined
    error: string | undefined
    loading: boolean
  }>({
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
          setState({
            data: undefined,
            error: e instanceof Error ? e.message : String(e),
            loading: false,
          })
        }
      },
    )
  }, deps)

  useEffect(() => {
    reload()
  }, [reload])

  return { ...state, reload }
}

/**
 * Terminal size that re-renders on resize — `useStdout()` alone does not
 * subscribe to the stream's 'resize' event, so layout math stays stale.
 */
export function useTermSize(): { columns: number; rows: number } {
  const { stdout } = useStdout()
  const [size, setSize] = useState({ columns: stdout?.columns ?? 80, rows: stdout?.rows ?? 24 })
  useEffect(() => {
    if (!stdout) return
    const onResize = () => setSize({ columns: stdout.columns, rows: stdout.rows })
    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout])
  return size
}
