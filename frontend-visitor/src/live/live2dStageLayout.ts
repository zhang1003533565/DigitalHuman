type Live2dStageLayoutInput = {
  stageWidth: number
  stageHeight: number
  modelWidth: number
  modelHeight: number
  scaleMultiplier?: number
  xOffsetRatio?: number
  yOffsetRatio?: number
}

type Live2dStageLayout = {
  scale: number
  x: number
  y: number
}

function positiveOr(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function resolveLive2dStageLayout({
  stageWidth,
  stageHeight,
  modelWidth,
  modelHeight,
  scaleMultiplier = 0.84,
  xOffsetRatio = 0,
  yOffsetRatio = 0.08,
}: Live2dStageLayoutInput): Live2dStageLayout {
  const safeStageWidth = positiveOr(stageWidth, 1)
  const safeStageHeight = positiveOr(stageHeight, 1)
  const safeModelWidth = positiveOr(modelWidth, safeStageWidth)
  const safeModelHeight = positiveOr(modelHeight, safeStageHeight)
  const safeScaleMultiplier = positiveOr(scaleMultiplier, 0.84)
  const scale = Math.min(safeStageWidth / safeModelWidth, safeStageHeight / safeModelHeight) * safeScaleMultiplier
  const safeXOffsetRatio = Number.isFinite(xOffsetRatio) ? xOffsetRatio : 0
  const safeYOffsetRatio = Number.isFinite(yOffsetRatio) ? yOffsetRatio : 0.08

  return {
    scale,
    x: (safeStageWidth - safeModelWidth * scale) / 2 + safeStageWidth * safeXOffsetRatio,
    y: safeStageHeight * safeYOffsetRatio,
  }
}
