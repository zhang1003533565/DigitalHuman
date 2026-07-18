type CleanupModel = {
  destroy?: () => void
}

type CleanupApplication<TModel extends CleanupModel> = {
  stage?: {
    removeChild?: (model: TModel) => void
  }
  destroy: (removeView: boolean, options: { children: boolean }) => void
}

type Live2dCleanupOptions<TModel extends CleanupModel> = {
  model: TModel | null
  app: CleanupApplication<TModel> | null
  stopSpeech: (model: TModel) => void
  onError?: (step: string, error: unknown) => void
}

type MutableRef<TValue> = {
  current: TValue | null
}

export function disposeLive2dResources<TModel extends CleanupModel>({
  model,
  app,
  stopSpeech,
  onError,
}: Live2dCleanupOptions<TModel>) {
  const run = (step: string, action: (() => void) | undefined) => {
    if (!action) return
    try {
      action()
    } catch (error) {
      onError?.(step, error)
    }
  }

  if (model) {
    run('stop-speech', () => stopSpeech(model))
    run('detach-model', app?.stage?.removeChild ? () => app.stage?.removeChild?.(model) : undefined)
    run('destroy-model', model.destroy ? () => model.destroy?.() : undefined)
  }
  run('destroy-application', app ? () => app.destroy(true, { children: false }) : undefined)
}

export function releaseLive2dRefs<TModel extends CleanupModel>({
  modelRef,
  appRef,
  stopSpeech,
  onError,
}: {
  modelRef: MutableRef<TModel>
  appRef: MutableRef<CleanupApplication<TModel>>
  stopSpeech: (model: TModel) => void
  onError?: (step: string, error: unknown) => void
}) {
  const model = modelRef.current
  const app = appRef.current
  modelRef.current = null
  appRef.current = null
  disposeLive2dResources({ model, app, stopSpeech, onError })
}
