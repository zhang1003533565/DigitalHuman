type MutableRef<T> = {
  current: T
}

type DisposableSpeechRecognition = {
  onresult: unknown
  onerror: unknown
  onend: unknown
  abort?: () => void
  stop?: () => void
}

function safelyInvoke(action: (() => void) | undefined) {
  try {
    action?.()
  } catch {
    // Browsers may throw when an already-ended recognition is cancelled again.
  }
}

export function invalidateSpeechRecognition<T extends DisposableSpeechRecognition>(
  recognitionRef: MutableRef<T | null>,
  generationRef: MutableRef<number>,
  stopRecognition = true,
) {
  const recognition = recognitionRef.current

  if (recognition) {
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
  }
  generationRef.current += 1
  recognitionRef.current = null

  if (stopRecognition && recognition) {
    safelyInvoke(recognition.abort?.bind(recognition))
    safelyInvoke(recognition.stop?.bind(recognition))
  }
}
