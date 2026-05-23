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
      from: (modelUrl: string) => Promise<Live2DModel>
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

export type ModelOption = {
  id: string
  name: string
  url: string
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

export const DEMO_AUDIO_URL = '/live2d/01_kei_zh.wav'
export const DEFAULT_TEXT = '你好，欢迎来到数字人导览模块。'
export const TTS_ENDPOINT = '/edge-tts/tts'
export const DEFAULT_RATE = 0
export const DEFAULT_VOLUME = 0
export const DEFAULT_PITCH = 0
export const DIGITAL_HUMAN_ROUTE = '/modules/digital-human'

let live2dScriptsPromise: Promise<void> | null = null

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    )

    if (existingScript) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = src
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
  model.speak(audioUrl, {
    volume: 1,
    crossOrigin: 'anonymous',
    onFinish: options?.onFinish,
    onError: options?.onError,
  })
}

export function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value}%`
}

export function formatPitch(value: number) {
  return `${value >= 0 ? '+' : ''}${value}Hz`
}
