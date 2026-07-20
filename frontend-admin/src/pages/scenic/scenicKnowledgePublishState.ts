import type { ScenicKnowledgePreview, ScenicKnowledgePublication } from '../../api/scenicStructured'

export type ScenicKnowledgePrimaryAction = 'publish' | 'view' | null

export type PublicationStatusLoadFailure = {
  kind: 'unpublished' | 'error'
  message: string | null
}

export function isCurrentScenicKnowledgePreview(
  preview: Pick<ScenicKnowledgePreview, 'recordId' | 'facilityId'> | null | undefined,
  recordId: number | null | undefined,
  facilityId: number | null | undefined,
) {
  return Boolean(preview && recordId && facilityId && preview.recordId === recordId && preview.facilityId === facilityId)
}

export function canPublishScenicKnowledge(params: {
  role: 'ADMIN' | 'OBSERVER'
  publishing: boolean
  recordId: number | null | undefined
  facilityId: number | null | undefined
  preview: Pick<ScenicKnowledgePreview, 'recordId' | 'facilityId'> | null | undefined
  accountId: number | null | undefined
  knowledgeId: string | null | undefined
  knowledgeName: string | null | undefined
}) {
  return params.role === 'ADMIN'
    && !params.publishing
    && isCurrentScenicKnowledgePreview(params.preview, params.recordId, params.facilityId)
    && Boolean(params.accountId)
    && Boolean(params.knowledgeId)
    && Boolean(params.knowledgeName)
}

export function nextScenicKnowledgeRequestGeneration(current: number) {
  return current + 1
}

export function shouldApplyScenicKnowledgeResponse(activeGeneration: number, settledGeneration: number) {
  return activeGeneration === settledGeneration
}

export function shouldLoadScenicKnowledgeTargets(role: 'ADMIN' | 'OBSERVER') {
  return role === 'ADMIN'
}

export function getScenicKnowledgePrimaryAction(
  applyStatus: string | null | undefined,
  role: 'ADMIN' | 'OBSERVER',
): ScenicKnowledgePrimaryAction {
  if (applyStatus !== 'applied') return null
  return role === 'ADMIN' ? 'publish' : 'view'
}

export function classifyPublicationStatusLoadFailure(params: {
  status?: number | null
  message?: string | null
}): PublicationStatusLoadFailure {
  if (params.status === 404) {
    return { kind: 'unpublished', message: null }
  }
  return {
    kind: 'error',
    message: params.message?.trim() || '状态加载失败',
  }
}

export function getScenicKnowledgeStatusPresentation(params: {
  applyStatus: string | null | undefined
  publication: Pick<ScenicKnowledgePublication, 'status'> | null | undefined
  statusLoadError?: string | null
}) {
  if (params.applyStatus !== 'applied') {
    return { kind: 'hint', text: '请先应用到正式景点' }
  }
  if (params.statusLoadError) {
    return { kind: 'error', text: '状态加载失败', detail: params.statusLoadError }
  }
  if (params.publication?.status) {
    return { kind: 'publication', status: params.publication.status }
  }
  return { kind: 'unpublished', text: '未发布' }
}
