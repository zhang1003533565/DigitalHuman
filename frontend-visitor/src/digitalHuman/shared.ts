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
    },
  ) => void
  motion: (name: string) => void
  expression: () => void
  destroy?: () => void
}

export type PixiApplication = {
  stage: {
    addChild: (model: Live2DModel) => void
    removeChild: (model: Live2DModel) => void
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

export const MODEL_OPTIONS = [
  {
    id: 'hiyori_pro_zh',
    name: 'Hiyori 中文模型',
    url: '/live2d/hiyori_pro_zh/hiyori_pro_t11.model3.json',
    scaleMultiplier: 0.9,
    xOffsetRatio: 0,
    yOffsetRatio: 0.06,
    bodyMotionGroup: 'Tap@Body',
  },
  {
    id: 'kei_vowels_pro',
    name: 'Kei 中文口型模型',
    url: '/live2d/kei_vowels_pro/kei_vowels_pro.model3.json',
  },
  {
    id: 'haru_greeter_pro_jp',
    name: 'Haru Greeter',
    url: '/live2d/haru_greeter_pro_jp/haru_greeter_t05.model3.json',
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

export function speak(model: Live2DModel, audioUrl: string) {
  model.speak(audioUrl, {
    volume: 1,
    crossOrigin: 'anonymous',
  })
}

export function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value}%`
}

export function formatPitch(value: number) {
  return `${value >= 0 ? '+' : ''}${value}Hz`
}
