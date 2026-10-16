export type Live2DModel = {
  width: number
  height: number
  x: number
  y: number
  dragging?: boolean
  _pointerX?: number
  _pointerY?: number
  buttonMode: boolean
  position: {
    x: number
    y: number
  }
  scale: {
    set: (value: number) => void
  }
  on: (eventName: string, handler: (...args: unknown[]) => void) => void
  speak: (
    audio: string,
    options?: {
      volume?: number
      expression?: number | string
      resetExpression?: boolean
      crossOrigin?: string
      onFinish?: () => void
      onError?: (error: Error) => void
    },
  ) => void
  stopSpeaking?: () => void
  motion: (name: string, index?: number) => void
  stopMotions?: () => void
  expression: () => void
  focus?: (x: number, y: number, instant?: boolean) => void
  internalModel?: {
    coreModel?: {
      setParameterValueById?: (id: string, value: number, weight?: number) => void
      addParameterValueById?: (id: string, value: number, weight?: number) => void
      getParameterValueById?: (id: string) => number
    }
    on?: (eventName: string, handler: () => void) => void
    off?: (eventName: string, handler: () => void) => void
  }
  destroy?: () => void
}

export type PixiApplication = {
  stage: {
    addChild: (model: Live2DModel) => void
    removeChild: (model: Live2DModel) => void
  }
  ticker?: {
    add: (fn: () => void) => void
    remove: (fn: () => void) => void
  }
  start: () => void
  stop: () => void
  destroy: (removeView?: boolean, options?: { children?: boolean }) => void
}

export type PixiGlobal = {
  Application: new (options: {
    view: HTMLCanvasElement
    autoStart: boolean
    resizeTo?: Window | HTMLElement
    backgroundAlpha?: number
    backgroundColor?: number
    width?: number
    height?: number
  }) => PixiApplication
  live2d: {
    Live2DModel: {
      from: (
        modelUrl: string,
        options?: {
          motionPreload?: 'NONE' | 'IDLE' | 'ALL'
        },
      ) => Promise<Live2DModel>
    }
  }
}

type DragPointerEvent = {
  data: {
    global: {
      x: number
      y: number
    }
  }
}

type DragBehaviorOptions = {
  onDragStart?: () => void
  onDragMove?: () => void
  onDragEnd?: () => void
}

const MOUTH_OPEN_PARAMETER_ID = 'ParamMouthOpenY'
const MOUTH_FORM_PARAMETER_ID = 'ParamMouthForm'
const activeSpeechStops = new WeakMap<Live2DModel, () => void>()
// 正在做"平滑收拢"的监听器，用于在新语音开始时先摘掉旧的写入者。
const releaseHandlers = new WeakMap<Live2DModel, () => void>()

export type ModelOption = {
  id: string
  name: string
  url: string
  costumes?: CostumeOption[]
  scaleMultiplier?: number
  xOffsetRatio?: number
  yOffsetRatio?: number
  bodyMotionGroup?: string
  dragStartMotionGroup?: string
  dragEndMotionGroup?: string
  motionOptions?: MotionOption[]
  microMotionOptions?: MotionOption[]
}

export type MotionOption = {
  label: string
  group: string
  index?: number
}

export type CostumeOption = {
  id: string
  name: string
  url: string
}

declare global {
  interface Window {
    PIXI?: PixiGlobal
  }
}

export const LIVE2D_SCRIPTS = [
  '/live2d/js/live2dcubismcore.min.js',
  '/live2d/js/live2d.min.js',
  '/live2d/js/pixi.min.js',
  '/live2d/js/cubism4.min.js',
]

const LIVE2D_ASSET_VERSION =
  typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_LIVE2D_ASSET_VERSION?.trim()
    : undefined

export const LIVE2D_MODEL_LOAD_OPTIONS = {
  motionPreload: 'NONE',
} as const

export function resolveLive2dAssetUrl(url: string) {
  if (!LIVE2D_ASSET_VERSION || !url.startsWith('/live2d/')) {
    return url
  }

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${encodeURIComponent(LIVE2D_ASSET_VERSION)}`
}

const HARU_MOTION_OPTIONS: MotionOption[] = [
  { label: '待机 Idle', group: 'Idle', index: 0 },
  { label: 'M01 待机点头', group: 'Action', index: 0 },
  { label: 'M02 背手点头', group: 'Action', index: 1 },
  { label: 'M03 抱臂无奈点头', group: 'Action', index: 2 },
  { label: 'M04 哦，抱臂点头', group: 'Action', index: 3 },
  { label: 'M05 惊讶点头', group: 'Action', index: 4 },
  { label: 'M06 微笑左摆手', group: 'Action', index: 5 },
  { label: 'M07 微笑右摆手', group: 'Action', index: 6 },
  { label: 'M08 给摸头', group: 'Action', index: 7 },
  { label: 'M09 前倾点头 / 鞠躬', group: 'Action', index: 8 },
  { label: 'M10 惊讶被摸头', group: 'Action', index: 9 },
  { label: 'M11 抱臂摇头', group: 'Action', index: 10 },
  { label: 'M12 摆手拒绝', group: 'Action', index: 11 },
  { label: 'M13 惊讶疑问眨眼', group: 'Action', index: 12 },
  { label: 'M14 惊讶疑问', group: 'Action', index: 13 },
  { label: 'M15 微笑轻微摇头', group: 'Action', index: 14 },
  { label: 'M16 抱歉', group: 'Action', index: 15 },
  { label: 'M17 凑近害羞', group: 'Action', index: 16 },
  { label: 'M18 害羞脸红', group: 'Action', index: 17 },
  { label: 'M19 低头害羞', group: 'Action', index: 18 },
  { label: 'M20 思考', group: 'Action', index: 19 },
  { label: 'M21 开心地跳起来', group: 'Action', index: 20 },
  { label: 'M22 害羞开心', group: 'Action', index: 21 },
  { label: 'M23 开心合手', group: 'Action', index: 22 },
  { label: 'M24 惊讶生气', group: 'Action', index: 23 },
  { label: 'M25 惊讶转微笑', group: 'Action', index: 24 },
  { label: 'M26 愣住转微笑', group: 'Action', index: 25 },
]

const HARU_MICRO_MOTION_OPTIONS: MotionOption[] = [
  { label: '招手 左', group: 'Action', index: 5 },
  { label: '招手 右', group: 'Action', index: 6 },
  { label: '摸头互动', group: 'Action', index: 7 },
  { label: '鞠躬', group: 'Action', index: 8 },
  { label: '拒绝', group: 'Action', index: 11 },
  { label: '抱歉', group: 'Action', index: 15 },
  { label: '害羞 凑近', group: 'Action', index: 16 },
  { label: '害羞 脸红', group: 'Action', index: 17 },
  { label: '害羞 低头', group: 'Action', index: 18 },
  { label: '思考', group: 'Action', index: 19 },
  { label: '跳跃', group: 'Action', index: 20 },
  { label: '开心合手', group: 'Action', index: 22 },
]

const HIYORI_MOTION_OPTIONS: MotionOption[] = [
  { label: '待机 01', group: 'Idle', index: 0 },
  { label: '待机 02', group: 'Idle', index: 1 },
  { label: '待机 03', group: 'Idle', index: 2 },
  { label: '轻扫', group: 'Flick', index: 0 },
  { label: '下滑', group: 'FlickDown', index: 0 },
  { label: '上滑', group: 'FlickUp', index: 0 },
  { label: '点击 01', group: 'Tap', index: 0 },
  { label: '点击 02', group: 'Tap', index: 1 },
  { label: '身体点击', group: 'Tap@Body', index: 0 },
  { label: '身体轻扫', group: 'Flick@Body', index: 0 },
]

const KEI_MOTION_OPTIONS: MotionOption[] = [
  { label: '英文口型动作', group: '', index: 0 },
  { label: '日文口型动作', group: '', index: 1 },
  { label: '韩文口型动作', group: '', index: 2 },
  { label: '中文口型动作', group: '', index: 3 },
]

const MARK_MOTION_OPTIONS: MotionOption[] = [
  { label: '待机', group: 'Idle', index: 0 },
  { label: '点击 01', group: 'Tap', index: 0 },
  { label: '点击 02', group: 'Tap', index: 1 },
  { label: '点击 03', group: 'Tap', index: 2 },
  { label: '下滑', group: 'FlickDown', index: 0 },
  { label: '上滑', group: 'FlickUp', index: 0 },
]

export const MODEL_OPTIONS = [
  {
    id: 'hiyori_pro_zh',
    name: 'Hiyori 中文模型',
    url: '/live2d/hiyori_pro_zh/hiyori_pro_t11.model3.json',
    scaleMultiplier: 0.9,
    xOffsetRatio: 0,
    yOffsetRatio: 0.06,
    bodyMotionGroup: 'Tap@Body',
    motionOptions: HIYORI_MOTION_OPTIONS,
  },
  {
    id: 'kei_vowels_pro',
    name: 'Kei 中文口型模型',
    url: '/live2d/kei_vowels_pro/kei_vowels_pro.model3.json',
    motionOptions: KEI_MOTION_OPTIONS,
  },
  {
    id: 'haru_greeter_pro_jp',
    name: 'Haru Greeter',
    url: '/live2d/haru_greeter_pro_jp/haru_greeter_t05.model3.json',
    costumes: [
      {
        id: 'default',
        name: '默认服装',
        url: '/live2d/haru_greeter_pro_jp/haru_greeter_t05.model3.json',
      },
      {
        id: 'white',
        name: '白色导览服',
        url: '/live2d/haru_greeter_pro_jp/haru_greeter_t05_white.model3.json',
      },
    ],
    motionOptions: HARU_MOTION_OPTIONS,
    microMotionOptions: HARU_MICRO_MOTION_OPTIONS,
  },
  {
    id: 'mark_free_zh',
    name: 'Mark 中文模型',
    url: '/live2d/mark_free_zh/mark_free_t04.model3.json',
    scaleMultiplier: 0.78,
    xOffsetRatio: 0,
    yOffsetRatio: 0.14,
    dragStartMotionGroup: 'FlickUp',
    dragEndMotionGroup: 'FlickDown',
    motionOptions: MARK_MOTION_OPTIONS,
  },
] satisfies ModelOption[]

export function getModelCostumeOptions(model?: ModelOption | null) {
  return model?.costumes?.length ? model.costumes : [{ id: 'default', name: '默认服装' }]
}

export function resolveModelUrl(model: ModelOption, costumeId?: string | null) {
  const costume = model.costumes?.find((item) => item.id === costumeId)
  return resolveLive2dAssetUrl(costume?.url ?? model.url)
}

export const VOICE_OPTIONS = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女声)' },
  { id: 'zh-CN-XiaoyiNeural', name: '小艺 (女声)' },
  { id: 'zh-CN-YunjianNeural', name: '云渐 (男声)' },
  { id: 'zh-CN-YunxiNeural', name: '云希 (男声)' },
  { id: 'zh-CN-YunxiaNeural', name: '云夏 (女声)' },
  { id: 'zh-CN-YunyangNeural', name: '云扬 (男声)' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', name: '小北 (东北话)' },
  { id: 'zh-CN-shaanxi-XiaoniNeural', name: '小妮 (陕西话)' },
  { id: 'zh-HK-HiuGaaiNeural', name: 'Hiugaai (粤语女声)' },
  { id: 'zh-HK-HiuMaanNeural', name: 'Hiumaan (粤语女声)' },
  { id: 'zh-HK-WanLungNeural', name: 'Wanlung (粤语男声)' },
  { id: 'zh-TW-HsiaoChenNeural', name: '晓珍 (台湾女声)' },
  { id: 'zh-TW-HsiaoYuNeural', name: '晓瑜 (台湾女声)' },
  { id: 'zh-TW-YunJheNeural', name: '云哲 (台湾男声)' },
]

export const TTS_ENDPOINT = '/edge-tts/tts'
export const DEFAULT_RATE = 0
export const DEFAULT_VOLUME = 0
export const DEFAULT_PITCH = 0
export const DIGITAL_HUMAN_ROUTE = '/modules/digital-human'
export const LIVE_BROADCAST_ROUTE = '/live'

export function createTtsPayload(text: string, voice = VOICE_OPTIONS[0].id) {
  return {
    text,
    voice,
    rate: formatPercent(DEFAULT_RATE),
    volume: formatPercent(DEFAULT_VOLUME),
    pitch: formatPitch(DEFAULT_PITCH),
  }
}

let live2dScriptsPromise: Promise<void> | null = null

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const versionedSrc = resolveLive2dAssetUrl(src)
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${versionedSrc}"]`,
    )

    if (existingScript) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = versionedSrc
    script.async = false
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`加载脚本失败：${src}`))
    document.body.appendChild(script)
  })
}

export function loadLive2dScripts() {
  if (!live2dScriptsPromise) {
    live2dScriptsPromise = LIVE2D_SCRIPTS.reduce(
      (promise, src) => promise.then(() => loadScript(src)),
      Promise.resolve(),
    )
  }

  return live2dScriptsPromise
}

export function makeDraggable(model: Live2DModel, options?: DragBehaviorOptions) {
  model.buttonMode = true

  model.on('pointerdown', (event) => {
    const pointerEvent = event as DragPointerEvent
    model.dragging = true
    model._pointerX = pointerEvent.data.global.x - model.x
    model._pointerY = pointerEvent.data.global.y - model.y
    options?.onDragStart?.()
  })

  model.on('pointermove', (event) => {
    if (!model.dragging) {
      return
    }

    const pointerEvent = event as DragPointerEvent
    model.position.x = pointerEvent.data.global.x - (model._pointerX ?? 0)
    model.position.y = pointerEvent.data.global.y - (model._pointerY ?? 0)
    options?.onDragMove?.()
  })

  model.on('pointerupoutside', () => {
    model.dragging = false
    options?.onDragEnd?.()
  })

  model.on('pointerup', () => {
    model.dragging = false
    options?.onDragEnd?.()
  })
}

export function speak(
  model: Live2DModel,
  audioUrl: string,
  options?: {
    onFinish?: () => void
    onError?: (error: Error) => void
  },
) {
  // 用 releaseMouth 而非 stopSpeech：只停掉上一次的播放，
  // 不把嘴硬归零，避免多段语音衔接时口型抽动。
  const prevStop = activeSpeechStops.get(model)
  if (prevStop) prevStop()
  releaseMouth(model)

  const audio = new Audio(audioUrl)
  audio.crossOrigin = 'anonymous'
  audio.preload = 'auto'
  audio.volume = 1
  const stopLipSync = startLipSync(model, audio)
  let settled = false
  let playbackTimer: number | null = null
  let stallTimer: number | null = null

  const clearPlaybackTimer = () => {
    if (playbackTimer !== null) {
      window.clearTimeout(playbackTimer)
      playbackTimer = null
    }
  }

  const clearStallTimer = () => {
    if (stallTimer !== null) {
      window.clearTimeout(stallTimer)
      stallTimer = null
    }
  }

  const schedulePlaybackGuard = (durationMs?: number) => {
    clearPlaybackTimer()
    const fallbackMs = durationMs && Number.isFinite(durationMs)
      ? Math.min(Math.max(durationMs + 3000, 8000), 90000)
      : 45000
    playbackTimer = window.setTimeout(() => {
      cleanup('finish')
    }, fallbackMs)
  }

  const scheduleStallGuard = () => {
    clearStallTimer()
    stallTimer = window.setTimeout(() => {
      cleanup('error', new Error('Audio playback stalled'))
    }, 6000)
  }

  const cleanup = (reason: 'finish' | 'error' | 'stop', error?: Error) => {
    if (settled) return
    settled = true

    clearPlaybackTimer()
    clearStallTimer()
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    stopLipSync()
    activeSpeechStops.delete(model)
    model.stopSpeaking?.()

    if (reason === 'finish') {
      options?.onFinish?.()
    } else if (reason === 'error') {
      options?.onError?.(error ?? new Error('Audio playback failed'))
    }
  }

  activeSpeechStops.set(model, () => cleanup('stop'))

  schedulePlaybackGuard(8000)
  audio.addEventListener('loadedmetadata', () => {
    schedulePlaybackGuard(audio.duration * 1000)
  }, { once: true })
  audio.addEventListener('playing', clearStallTimer)
  audio.addEventListener('canplay', clearStallTimer)
  audio.addEventListener('timeupdate', clearStallTimer)
  audio.addEventListener('waiting', scheduleStallGuard)
  audio.addEventListener('stalled', scheduleStallGuard)
  audio.addEventListener('ended', () => cleanup('finish'), { once: true })
  audio.addEventListener('error', () => cleanup('error', new Error('Audio playback failed')), { once: true })

  void audio.play().catch((error) => {
    cleanup('error', error instanceof Error ? error : new Error(String(error)))
  })
}

export function stopSpeech(model: Live2DModel) {
  const stopActiveSpeech = activeSpeechStops.get(model)
  if (stopActiveSpeech) {
    stopActiveSpeech()
    return
  }

  model.stopSpeaking?.()
  resetMouth(model)
}

// 上一段语音结束到下一段开始之间，不要把嘴硬砸回 0。
// 多段音频连续播放时，speak() 每次都先调 stopSpeech()，
// 若此处强制归零，嘴会在 "说话值" 与 0 之间反复跳变，
// 看起来就像嘴在抽动而不是在说话。
function releaseMouth(model: Live2DModel) {
  model.stopSpeaking?.()
}

// 共用一个 AudioContext：每段语音都新建会很快触达浏览器的上下文数量上限。
let sharedAudioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new Ctor()
  }
  return sharedAudioContext
}

/**
 * 口型由音频包络驱动：读实际播放波形的 RMS 得到张嘴幅度。
 * 之前用固定正弦波，幅度和语音内容无关，且嘴始终停在半开位置不闭合，
 * 看上去像"张着嘴抖动"而不是在说话。
 */
function startLipSync(model: Live2DModel, audio: HTMLAudioElement) {
  const internalModel = model.internalModel
  const coreModel = internalModel?.coreModel
  if (!coreModel?.setParameterValueById || typeof window === 'undefined') {
    return () => undefined
  }

  // 若上一段语音还处在"平滑收拢"阶段，先摘掉它的监听，
  // 否则新旧两个写入者会同时改口型参数、互相打架。
  const pendingRelease = releaseHandlers.get(model)
  if (pendingRelease) {
    internalModel?.off?.('afterMotionUpdate', pendingRelease)
    releaseHandlers.delete(model)
  }

  // 建立音频分析链路。失败时退回正弦波，保证口型不会完全失效。
  let analyser: AnalyserNode | null = null
  let samples: Uint8Array<ArrayBuffer> | null = null
  let sourceNode: MediaElementAudioSourceNode | null = null
  try {
    const ctx = getAudioContext()
    if (ctx) {
      sourceNode = ctx.createMediaElementSource(audio)
      analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.5
      sourceNode.connect(analyser)
      // 必须再接回输出，否则音频会被 Web Audio 图吞掉、彻底没声音。
      analyser.connect(ctx.destination)
      samples = new Uint8Array(analyser.fftSize)
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
    }
  } catch {
    analyser = null
    samples = null
  }

  let stopped = false
  let frameId: number | null = null
  let currentOpen = 0
  let currentForm = 0
  let lastTick = performance.now()
  const startedAt = lastTick

  // 口型必须写在 Idle 动作之后。
  // internalModel.update() 的顺序是：motionManager.update()（会把 ParamMouthOpenY 写回 0）
  // → emit('afterMotionUpdate') → saveParameters() → ... → coreModel.update()。
  // 挂在 afterMotionUpdate 上，写入的值才不会被待机动作覆盖。
  const applyLipSync = () => {
    if (stopped) return

    const now = performance.now()
    // 帧间隔兜底，避免切页回来时 delta 跳变导致口型瞬间张到最大。
    const delta = Math.min(Math.max(now - lastTick, 0), 100) / 1000
    lastTick = now

    let level: number
    if (analyser && samples) {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (let i = 0; i < samples.length; i += 1) {
        const v = (samples[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / samples.length)
      // 噪声门限：安静段直接闭嘴；语音段按能量张开。
      level = Math.min(1, Math.max(0, (rms - 0.012) * 6.5))
    } else {
      const elapsed = (now - startedAt) / 1000
      level = Math.abs(Math.sin(elapsed * 12.5)) * 0.7
    }

    const targetOpen = level * 0.95
    const targetForm = Math.min(0.2, Math.max(-0.06, targetOpen * 0.18 - 0.02))

    // 张嘴快、闭嘴稍慢，比对称插值更像说话。
    const blend = 1 - Math.exp((targetOpen > currentOpen ? -34 : -16) * delta)
    const formBlend = 1 - Math.exp(-18 * delta)
    currentOpen += (targetOpen - currentOpen) * blend
    currentForm += (targetForm - currentForm) * formBlend

    coreModel.setParameterValueById?.(MOUTH_OPEN_PARAMETER_ID, currentOpen, 1)
    coreModel.setParameterValueById?.(MOUTH_FORM_PARAMETER_ID, currentForm, 1)
  }

  // 停止时让嘴平滑闭合，而不是瞬间 set 0 —— 后者在连续语音之间会造成可见抽动。
  const RELEASE_PER_FRAME = 0.6
  const releaseLipSync = () => {
    if (stopped) return
    currentOpen *= RELEASE_PER_FRAME
    currentForm *= RELEASE_PER_FRAME
    if (currentOpen < 0.01) {
      currentOpen = 0
      currentForm = 0
      coreModel.setParameterValueById?.(MOUTH_OPEN_PARAMETER_ID, 0, 1)
      coreModel.setParameterValueById?.(MOUTH_FORM_PARAMETER_ID, 0, 1)
      stopped = true
      internalModel?.off?.('afterMotionUpdate', releaseLipSync)
      if (releaseHandlers.get(model) === releaseLipSync) {
        releaseHandlers.delete(model)
      }
      return
    }
    coreModel.setParameterValueById?.(MOUTH_OPEN_PARAMETER_ID, currentOpen, 1)
    coreModel.setParameterValueById?.(MOUTH_FORM_PARAMETER_ID, currentForm, 1)
  }

  if (internalModel?.on) {
    internalModel.on('afterMotionUpdate', applyLipSync)
  } else {
    // 极端兜底：库未暴露事件时退回 rAF（口型可能仍被动作覆盖，但不会静默失效）。
    const tick = () => {
      if (stopped) return
      applyLipSync()
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
  }

  return () => {
    try {
      sourceNode?.disconnect()
      analyser?.disconnect()
    } catch {
      // 忽略断开失败
    }

    if (stopped) {
      internalModel?.off?.('afterMotionUpdate', applyLipSync)
      internalModel?.off?.('afterMotionUpdate', releaseLipSync)
      return
    }
    // 切换到平滑释放：让嘴在几帧内收拢，而不是硬 set 0。
    internalModel?.off?.('afterMotionUpdate', applyLipSync)
    if (internalModel?.on) {
      releaseHandlers.set(model, releaseLipSync)
      internalModel.on('afterMotionUpdate', releaseLipSync)
    } else {
      stopped = true
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
        frameId = null
      }
      resetMouth(model)
    }
  }
}

function resetMouth(model: Live2DModel) {
  const coreModel = model.internalModel?.coreModel
  coreModel?.setParameterValueById?.(MOUTH_OPEN_PARAMETER_ID, 0, 1)
  coreModel?.setParameterValueById?.(MOUTH_FORM_PARAMETER_ID, 0, 1)
}

export function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value}%`
}

export function formatPitch(value: number) {
  return `${value >= 0 ? '+' : ''}${value}Hz`
}
