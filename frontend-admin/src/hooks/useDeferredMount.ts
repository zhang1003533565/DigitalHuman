import { useEffect } from 'react'

export function useDeferredMount(callback: () => void) {
  useEffect(() => {
    const timeoutId = window.setTimeout(callback, 0)
    return () => window.clearTimeout(timeoutId)
    // Run only once after mount; callers use this for initial async loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
