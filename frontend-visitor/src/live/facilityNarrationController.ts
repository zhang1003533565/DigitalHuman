type NarrationControllerOptions = {
  speakAudio: (url: string) => Promise<void>
  stopAudio: () => void
  delayMs?: number
  onError?: (error: Error) => void
}

export type FacilityNarrationController = {
  start: (url: string) => void
  interrupt: () => void
  resume: () => void
  destroy: () => void
}

export function createNarrationController({
  speakAudio,
  stopAudio,
  delayMs = 2000,
  onError,
}: NarrationControllerOptions): FacilityNarrationController {
  let audioUrl: string | null = null
  let active = false
  let destroyed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let generation = 0

  const clearLoopTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const play = (playGeneration: number) => {
    if (!active || destroyed || !audioUrl) return
    void speakAudio(audioUrl)
      .then(() => {
        if (!active || destroyed || generation !== playGeneration || !audioUrl) return
        timer = setTimeout(() => {
          timer = null
          play(playGeneration)
        }, delayMs)
      })
      .catch((error) => {
        if (!active || destroyed || generation !== playGeneration || !audioUrl) return
        active = false
        onError?.(error instanceof Error ? error : new Error(String(error)))
      })
  }

  return {
    start(url: string) {
      audioUrl = url
      active = true
      destroyed = false
      generation += 1
      clearLoopTimer()
      play(generation)
    },
    interrupt() {
      active = false
      generation += 1
      clearLoopTimer()
      stopAudio()
    },
    resume() {
      if (!audioUrl || destroyed) return
      active = true
      generation += 1
      clearLoopTimer()
      play(generation)
    },
    destroy() {
      active = false
      destroyed = true
      generation += 1
      clearLoopTimer()
      stopAudio()
    },
  }
}
