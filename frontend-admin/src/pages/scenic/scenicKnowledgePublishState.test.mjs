import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canPublishScenicKnowledge,
  classifyPublicationStatusLoadFailure,
  getScenicKnowledgePrimaryAction,
  getScenicKnowledgeStatusPresentation,
  isCurrentScenicKnowledgePreview,
  nextScenicKnowledgeRequestGeneration,
  shouldApplyScenicKnowledgeResponse,
  shouldLoadScenicKnowledgeTargets,
} from './scenicKnowledgePublishState.ts'

test('stale preview cannot enable publish', () => {
  const stalePreview = { recordId: 8, facilityId: 12 }
  assert.equal(isCurrentScenicKnowledgePreview(stalePreview, 9, 12), false)
  assert.equal(canPublishScenicKnowledge({
    role: 'ADMIN',
    publishing: false,
    recordId: 9,
    facilityId: 12,
    preview: stalePreview,
    accountId: 3,
    knowledgeId: 'kb-1',
    knowledgeName: '灵山知识库',
  }), false)
})

test('observer never gets mutation action for applied row', () => {
  assert.equal(getScenicKnowledgePrimaryAction('applied', 'OBSERVER'), 'view')
  assert.equal(getScenicKnowledgePrimaryAction('applied', 'ADMIN'), 'publish')
  assert.equal(getScenicKnowledgePrimaryAction('pending', 'ADMIN'), null)
})

test('stale async generation is rejected', () => {
  const generation1 = nextScenicKnowledgeRequestGeneration(0)
  const generation2 = nextScenicKnowledgeRequestGeneration(generation1)
  assert.equal(shouldApplyScenicKnowledgeResponse(generation2, generation1), false)
  assert.equal(shouldApplyScenicKnowledgeResponse(generation2, generation2), true)
})

test('status load classification treats only 404 as unpublished', () => {
  assert.deepEqual(classifyPublicationStatusLoadFailure({ status: 404, message: 'not found' }), {
    kind: 'unpublished',
    message: null,
  })
  assert.deepEqual(classifyPublicationStatusLoadFailure({ status: 500, message: '服务异常' }), {
    kind: 'error',
    message: '服务异常',
  })
  assert.deepEqual(getScenicKnowledgeStatusPresentation({
    applyStatus: 'applied',
    publication: null,
    statusLoadError: '服务异常',
  }), {
    kind: 'error',
    text: '状态加载失败',
    detail: '服务异常',
  })
})

test('observer preview does not depend on admin-only MaxKB target discovery', () => {
  assert.equal(shouldLoadScenicKnowledgeTargets('OBSERVER'), false)
  assert.equal(shouldLoadScenicKnowledgeTargets('ADMIN'), true)
})
