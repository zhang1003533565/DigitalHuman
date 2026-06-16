import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  type Live2DModel,
  type MotionOption,
  type PixiApplication,
  MODEL_OPTIONS,
  loadLive2dScripts,
  makeDraggable,
} from '../digitalHuman/shared'

type SpeechMotion = {
  group: string
  index?: number
}

export type DigitalHumanSpeechRequest = {
  text: string
  voiceId?: string
  rate?: number
  volume?: number
  pitch?: number
  motion?: SpeechMotion
  streamIntervalMs?: number
}

export type LoginDigitalHumanAssistantHandle = {
  speak: (request: DigitalHumanSpeechRequest) => Promise<boolean>
  interrupt: () => void
  playMotion: (motion: MotionOption | SpeechMotion) => void
}

type LoginDigitalHumanAssistantProps = {
  initialSpeech?: DigitalHumanSpeechRequest
  autoPlayInitialSpeech?: boolean
}

const DEFAULT_STREAM_INTERVAL = 75
const LOGIN_DEMO_AUDIO_URL = '/live2d/demo.mp3'
const MOUTH_OPEN_PARAMETER_ID = 'ParamMouthOpenY'
const MOUTH_FORM_PARAMETER_ID = 'ParamMouthForm'
const IDLE_STATUS = ''
const LOADING_STATUS = '数字人加载中...'
const READY_STATUS = '数字人已就绪。'

type OutfitOption = {
  id: string
  label: string
  modelUrl: string
}

const OUTFIT_OPTIONS: OutfitOption[] = [
  {
    id: 'default',
    label: '黑色商务',
    modelUrl: '/live2d/haru_greeter_pro_jp/haru_greeter_t05.model3.json',
  },
  {
    id: 'white',
    label: '白色商务',
    modelUrl: '/live2d/haru_greeter_pro_jp/haru_greeter_t05_white.model3.json',
  },
]

function isUserGestureRequired(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  return (
    error.name === 'NotAllowedError' ||
    message.includes("user didn't interact") ||
    message.includes('user did not interact') ||
    message.includes('not allowed') ||
    message.includes('gesture')
  )
}

export const LoginDigitalHumanAssistant = forwardRef<
  LoginDigitalHumanAssistantHandle,
  LoginDigitalHumanAssistantProps
>(function LoginDigitalHumanAssistant(
  { initialSpeech, autoPlayInitialSpeech = false },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const modelRef = useRef<Live2DModel | null>(null)
  const appRef = useRef<PixiApplication | null>(null)
  const homePositionRef = useRef({ x: 0, y: 0 })
  const returnTimerRef = useRef<number | null>(null)
  const returnFrameRef = useRef<number | null>(null)
  const streamTimerRef = useRef<number | null>(null)
  const bubbleFrameRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const lipSyncFrameRef = useRef<number | null>(null)
  const playbackTokenRef = useRef(0)
  const [isReady, setIsReady] = useState(false)
  const [status, setStatus] = useState(LOADING_STATUS)
  const [visibleText, setVisibleText] = useState('')

  const selectedModel = MODEL_OPTIONS.find((model) => model.id === 'haru_greeter_pro_jp') ?? MODEL_OPTIONS[0]
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0)
  const currentOutfit = OUTFIT_OPTIONS[currentOutfitIndex]
  const outfitKeyRef = useRef(0)

  const syncBubblePosition = useCallback(() => {
    const bubble = bubbleRef.current
    const model = modelRef.current

    if (!bubble || !model) {
      return
    }

    const anchorX = model.x + model.width * 0.47 + 18
    const anchorY = model.y + model.height * 0.08
    const bubbleHalfWidth = bubble.offsetWidth / 2
    const viewportPadding = 22
    const minX = viewportPadding + bubbleHalfWidth
    const maxX = window.innerWidth - viewportPadding - bubbleHalfWidth
    const bubbleX = Math.min(Math.max(anchorX, minX), maxX)
    const bubbleY = Math.max(64, anchorY - 96)

    bubble.style.left = `${bubbleX}px`
    bubble.style.top = `${bubbleY}px`
  }, [])

  const stopBubbleTracking = useCallback(() => {
    if (bubbleFrameRef.current !== null) {
      window.cancelAnimationFrame(bubbleFrameRef.current)
      bubbleFrameRef.current = null
    }
  }, [])

  const startBubbleTracking = useCallback(() => {
    stopBubbleTracking()

    const tick = () => {
      syncBubblePosition()
      bubbleFrameRef.current = window.requestAnimationFrame(tick)
    }

    tick()
  }, [stopBubbleTracking, syncBubblePosition])

  const clearReturnAnimation = useCallback(() => {
    if (returnTimerRef.current !== null) {
      window.clearTimeout(returnTimerRef.current)
      returnTimerRef.current = null
    }

    if (returnFrameRef.current !== null) {
      window.cancelAnimationFrame(returnFrameRef.current)
      returnFrameRef.current = null
    }
  }, [])

  const clearStreamingText = useCallback(() => {
    if (streamTimerRef.current !== null) {
      window.clearTimeout(streamTimerRef.current)
      streamTimerRef.current = null
    }
  }, [])

  const stopLipSync = useCallback(() => {
    if (lipSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(lipSyncFrameRef.current)
      lipSyncFrameRef.current = null
    }
  }, [])

  const resetMouth = useCallback(() => {
    const coreModel = modelRef.current?.internalModel?.coreModel
    coreModel?.setParameterValueById?.(MOUTH_OPEN_PARAMETER_ID, 0)
    coreModel?.setParameterValueById?.(MOUTH_FORM_PARAMETER_ID, 0)
  }, [])

  const ensureAudioElement = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.setAttribute('playsinline', 'true')
      audio.src = LOGIN_DEMO_AUDIO_URL
      audioRef.current = audio
    }

    return audioRef.current
  }, [])

  const ensureLipSyncPipeline = useCallback(() => {
    const audio = ensureAudioElement()

    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext || (window as Window & {
        webkitAudioContext?: typeof AudioContext
      }).webkitAudioContext

      if (!AudioContextCtor) {
        throw new Error('当前浏览器不支持 Web Audio。')
      }

      audioContextRef.current = new AudioContextCtor()
    }

    if (!analyserRef.current && audioContextRef.current) {
      const analyser = audioContextRef.current.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7
      analyserRef.current = analyser
    }

    if (
      !mediaSourceRef.current &&
      audioContextRef.current &&
      analyserRef.current
    ) {
      const source = audioContextRef.current.createMediaElementSource(audio)
      source.connect(analyserRef.current)
      analyserRef.current.connect(audioContextRef.current.destination)
      mediaSourceRef.current = source
    }
  }, [ensureAudioElement])

  const startLipSync = useCallback(() => {
    const analyser = analyserRef.current
    const coreModel = modelRef.current?.internalModel?.coreModel

    if (!analyser || !coreModel) {
      return
    }

    stopLipSync()
    const data = new Uint8Array(analyser.fftSize)

    const tick = () => {
      const currentAnalyser = analyserRef.current
      const currentCoreModel = modelRef.current?.internalModel?.coreModel
      const currentAudio = audioRef.current

      if (!currentAnalyser || !currentCoreModel || !currentAudio || currentAudio.paused || currentAudio.ended) {
        resetMouth()
        lipSyncFrameRef.current = null
        return
      }

      currentAnalyser.getByteTimeDomainData(data)

      let sumSquares = 0
      for (let index = 0; index < data.length; index += 1) {
        const centered = ((data[index] ?? 128) - 128) / 128
        sumSquares += centered * centered
      }
      const rms = Math.sqrt(sumSquares / data.length)
      const gate = 0.03
      const normalized = Math.max(0, (rms - gate) / (0.22 - gate))
      const mouthOpen = Math.min(1, Math.max(0, normalized * 1.15))
      const mouthForm = Math.min(0.25, Math.max(-0.12, normalized * 0.25 - 0.03))
      const currentOpen = currentCoreModel.getParameterValueById?.(MOUTH_OPEN_PARAMETER_ID) ?? 0
      const currentForm = currentCoreModel.getParameterValueById?.(MOUTH_FORM_PARAMETER_ID) ?? 0
      const smoothedOpen = currentOpen + (mouthOpen - currentOpen) * 0.35
      const smoothedForm = currentForm + (mouthForm - currentForm) * 0.3

      currentCoreModel.setParameterValueById?.(MOUTH_OPEN_PARAMETER_ID, smoothedOpen)
      currentCoreModel.setParameterValueById?.(MOUTH_FORM_PARAMETER_ID, smoothedForm)

      lipSyncFrameRef.current = window.requestAnimationFrame(tick)
    }

    lipSyncFrameRef.current = window.requestAnimationFrame(tick)
  }, [resetMouth, stopLipSync])

  const stopSpeaking = useCallback(() => {
    playbackTokenRef.current += 1
    clearStreamingText()
    stopLipSync()
    resetMouth()

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.oncanplaythrough = null
    }
  }, [clearStreamingText, resetMouth, stopLipSync])

  const animateBackToHome = useCallback(() => {
    const step = () => {
      const currentModel = modelRef.current

      if (!currentModel || currentModel.dragging) {
        returnFrameRef.current = null
        return
      }

      const dx = homePositionRef.current.x - currentModel.x
      const dy = homePositionRef.current.y - currentModel.y

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        currentModel.position.x = homePositionRef.current.x
        currentModel.position.y = homePositionRef.current.y
        syncBubblePosition()
        returnFrameRef.current = null
        return
      }

      currentModel.position.x += dx * 0.12
      currentModel.position.y += dy * 0.12
      syncBubblePosition()
      returnFrameRef.current = window.requestAnimationFrame(step)
    }

    returnFrameRef.current = window.requestAnimationFrame(step)
  }, [])

  const scheduleReturnToHome = useCallback(() => {
    clearReturnAnimation()
    returnTimerRef.current = window.setTimeout(() => {
      animateBackToHome()
    }, 1800)
  }, [animateBackToHome, clearReturnAnimation])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const model = modelRef.current

    if (!canvas) {
      return
    }

    const width = window.innerWidth
    const height = window.innerHeight

    canvas.width = width
    canvas.height = height

    if (!model) {
      return
    }

    homePositionRef.current = {
      x: width * 0.42 - model.width * 0.14,
      y: Math.max(height * 0.58 - model.height * 0.5, 160),
    }

    if (!model.dragging) {
      model.position.x = homePositionRef.current.x
      model.position.y = homePositionRef.current.y
    }

    syncBubblePosition()
  }, [])

  const playMotion = useCallback((motion: MotionOption | SpeechMotion) => {
    const model = modelRef.current

    if (!model) {
      return false
    }

    try {
      model.motion(motion.group, motion.index)
      return true
    } catch (error) {
      console.warn('Play motion failed', motion, error)
      return false
    }
  }, [])

  const streamText = useCallback(
    (text: string, streamIntervalMs: number, token: number) =>
      new Promise<void>((resolve) => {
        clearStreamingText()
        setVisibleText('')

        if (!text) {
          resolve()
          return
        }

        let index = 0

        const tick = () => {
          if (token !== playbackTokenRef.current) {
            resolve()
            return
          }

          index += 1
          setVisibleText(text.slice(0, index))

          if (index >= text.length) {
            streamTimerRef.current = null
            resolve()
            return
          }

          streamTimerRef.current = window.setTimeout(tick, streamIntervalMs)
        }

        tick()
      }),
    [clearStreamingText],
  )

  const speak = useCallback(
    async ({
      text,
      motion,
      streamIntervalMs = DEFAULT_STREAM_INTERVAL,
    }: DigitalHumanSpeechRequest) => {
      const model = modelRef.current
      const content = text.trim()

      if (!model || !content) {
        setStatus(content ? '数字人还没有加载完成。' : '没有可播报的文本。')
        return false
      }

      stopSpeaking()
      const token = playbackTokenRef.current
      setStatus(IDLE_STATUS)
      setVisibleText('')

      try {
        if (token !== playbackTokenRef.current) {
          return false
        }

        const streamPromise = streamText(content, streamIntervalMs, token)

        if (motion) {
          const didPlay = playMotion(motion)

          if (!didPlay) {
            playMotion({ group: 'Action', index: 6 })
          }
        }

        const audio = ensureAudioElement()

        if (!audio) {
          throw new Error('演示音频尚未初始化。')
        }

        audio.currentTime = 0

        audio.onended = () => {
          if (token !== playbackTokenRef.current) {
            return
          }

          stopLipSync()
          resetMouth()
          setStatus(IDLE_STATUS)
        }

        audio.onerror = () => {
          if (token !== playbackTokenRef.current) {
            return
          }

          stopLipSync()
          resetMouth()
          setStatus('语音暂不可用，文字已为你展示。')
        }

        const playPromise = audio.play()
        await playPromise

        try {
          ensureLipSyncPipeline()

          if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume()
          }

          startLipSync()
        } catch (lipSyncError) {
          console.warn(lipSyncError)
        }

        await streamPromise
        return true
      } catch (error) {
        if (token !== playbackTokenRef.current) {
          return false
        }

        console.error(error)
        stopLipSync()
        resetMouth()
        setStatus(isUserGestureRequired(error) ? IDLE_STATUS : '语音暂不可用，文字已为你展示。')
        return false
      }
    },
    [ensureAudioElement, ensureLipSyncPipeline, playMotion, resetMouth, startLipSync, stopLipSync, stopSpeaking, streamText],
  )

  useImperativeHandle(
    ref,
    () => ({
      speak,
      interrupt: stopSpeaking,
      playMotion,
    }),
    [playMotion, speak, stopSpeaking],
  )

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas || appRef.current) {
      return
    }

    let cancelled = false

    async function initApp() {
      await loadLive2dScripts()

      if (cancelled || !window.PIXI || !canvas) {
        return
      }

      const width = window.innerWidth
      const height = window.innerHeight

      const pixiApp = new window.PIXI.Application({
        view: canvas,
        autoStart: true,
        resizeTo: window,
        width,
        height,
        backgroundAlpha: 0,
        backgroundColor: 0x000000,
      })

      appRef.current = pixiApp
    }

    void initApp()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadModel() {
      if (!appRef.current) {
        await loadLive2dScripts()
        // Wait a tick for app to be ready
        await new Promise((r) => setTimeout(r, 100))
      }

      const pixiApp = appRef.current

      if (!pixiApp || !window.PIXI) {
        return
      }

      setIsReady(false)
      setStatus(LOADING_STATUS)

      // Remove old model from stage
      if (modelRef.current) {
        pixiApp.stage.removeChild(modelRef.current)
        modelRef.current.destroy?.()
        modelRef.current = null
      }

      try {
        const model = await window.PIXI.live2d.Live2DModel.from(currentOutfit.modelUrl)

        if (!mounted) {
          return
        }

        pixiApp.stage.addChild(model)

        const width = window.innerWidth
        const height = window.innerHeight
        const scaleX = width / model.width
        const scaleY = height / model.height
        const scaleMultiplier = (selectedModel.scaleMultiplier ?? 0.84) * 0.74

        model.scale.set(Math.min(scaleX, scaleY) * (scaleMultiplier + 0.1))
        homePositionRef.current = {
          x: width * 0.42 - model.width * 0.14,
          y: Math.max(height * 0.58 - model.height * 0.5, 160),
        }
        model.x = homePositionRef.current.x
        model.y = homePositionRef.current.y

        makeDraggable(model, {
          onDragStart: () => {
            clearReturnAnimation()

            if (selectedModel.dragStartMotionGroup) {
              model.motion(selectedModel.dragStartMotionGroup)
            }
          },
          onDragMove: clearReturnAnimation,
          onDragEnd: () => {
            if (selectedModel.dragEndMotionGroup) {
              model.motion(selectedModel.dragEndMotionGroup)
            }

            scheduleReturnToHome()
          },
        })

        model.on('hit', (...args: unknown[]) => {
          const hitAreas = Array.isArray(args[0]) ? (args[0] as string[]) : []

          if (hitAreas.includes('Head')) {
            model.expression()
            return
          }

          if (hitAreas.includes('Body') && selectedModel.bodyMotionGroup) {
            model.motion(selectedModel.bodyMotionGroup)
          }
        })

        modelRef.current = model
        resizeCanvas()
        syncBubblePosition()
        startBubbleTracking()
        window.addEventListener('resize', resizeCanvas)
        ensureAudioElement().load()
        setIsReady(true)
        setStatus(READY_STATUS)
      } catch (error) {
        console.error(error)
        setStatus('数字人加载失败，请检查 Live2D 资源。')
      }
    }

    void loadModel()

    return () => {
      mounted = false
      stopSpeaking()
      clearReturnAnimation()
      stopBubbleTracking()
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [
    clearReturnAnimation,
    ensureAudioElement,
    resizeCanvas,
    scheduleReturnToHome,
    selectedModel.bodyMotionGroup,
    selectedModel.dragEndMotionGroup,
    selectedModel.dragStartMotionGroup,
    selectedModel.scaleMultiplier,
    currentOutfit.modelUrl,
    startBubbleTracking,
    stopSpeaking,
    stopBubbleTracking,
    syncBubblePosition,
  ])

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close().catch(() => undefined)
      modelRef.current = null
      appRef.current?.destroy(true, { children: true })
      appRef.current = null
    }
  }, [])

  const handleOutfitSwitch = useCallback(() => {
    setCurrentOutfitIndex((prev) => (prev + 1) % OUTFIT_OPTIONS.length)
    outfitKeyRef.current += 1
  }, [])

  useEffect(() => {
    if (!isReady || !autoPlayInitialSpeech || !initialSpeech) {
      return
    }

    void speak(initialSpeech)
  }, [autoPlayInitialSpeech, initialSpeech, isReady, speak])

  const hasVisibleText = visibleText.trim().length > 0
  const hasHintStatus = Boolean(status) && ![LOADING_STATUS, READY_STATUS].includes(status)
  const shouldShowBubble =
    hasVisibleText ||
    hasHintStatus

  return (
    <section className="login-dh-embed" aria-label="登录页数字人交互区">
      <div className="login-dh-stage">
        <canvas ref={canvasRef} className="login-dh-canvas" />
        {shouldShowBubble ? (
          <div ref={bubbleRef} className="login-dh-bubble" aria-live="polite">
            {hasVisibleText ? <p className="login-dh-bubble__text">{visibleText}</p> : null}
            {hasHintStatus ? <p className="login-dh-bubble__hint">{status}</p> : null}
          </div>
        ) : null}
        <button
          type="button"
          className="login-dh-outfit-btn"
          onClick={handleOutfitSwitch}
          title="换装"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z" />
          </svg>
          <span>{currentOutfit.label}</span>
        </button>
      </div>
    </section>
  )
})
