import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const drawerSource = readFileSync(new URL('./ScenicKnowledgePublishDrawer.tsx', import.meta.url), 'utf8')
const apiSource = readFileSync(new URL('../../api/scenicStructured.ts', import.meta.url), 'utf8')

assert.match(apiSource, /previewScenicKnowledgePublication/)
assert.match(apiSource, /publishScenicKnowledge/)
assert.match(apiSource, /getScenicKnowledgePublicationStatus/)
assert.match(apiSource, /withdrawScenicKnowledge/)
assert.match(apiSource, /export type ScenicKnowledgePublicationStatus =/)
assert.match(apiSource, /\| 'publishing'/)
assert.match(apiSource, /\| 'published'/)
assert.match(apiSource, /\| 'outdated'/)
assert.match(apiSource, /\| 'failed'/)
assert.match(apiSource, /\| 'withdrawn'/)

assert.match(drawerSource, /listKnowledgeAccounts/)
assert.match(drawerSource, /getKnowledges/)
assert.match(drawerSource, /Observer 只读/)
assert.match(drawerSource, /Markdown 预览/)
assert.match(drawerSource, /发布到知识库/)
assert.match(drawerSource, /重新发布/)
assert.match(drawerSource, /撤回知识/)
assert.match(drawerSource, /disabled=\{isObserver \|\| publishing \|\| !canPublish\}/)
assert.match(drawerSource, /disabled=\{isObserver \|\| withdrawing\}/)

console.log('scenic knowledge publish drawer contract passed')
