type HistoryLoadOptions<T> = {
  signal: AbortSignal
  request: (signal: AbortSignal) => Promise<T[]>
  isCanceled: (error: unknown) => boolean
}

type HistoryLoadResult<T> =
  | { status: 'success'; messages: T[] }
  | { status: 'aborted' }
  | { status: 'error' }

export async function loadHistoryMessages<T>({
  signal,
  request,
  isCanceled,
}: HistoryLoadOptions<T>): Promise<HistoryLoadResult<T>> {
  try {
    return { status: 'success', messages: await request(signal) }
  } catch (error: unknown) {
    if (signal.aborted || isCanceled(error)) return { status: 'aborted' }
    return { status: 'error' }
  }
}
