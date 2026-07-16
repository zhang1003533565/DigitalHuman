import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('./KnowledgeOpenApiPage.tsx', import.meta.url), 'utf8')
const appCss = readFileSync(new URL('../App.css', import.meta.url), 'utf8')
const cockpitCss = readFileSync(new URL('../admin-cockpit.css', import.meta.url), 'utf8')

test('knowledge page delegates upload to the MaxKB-style workbench', () => {
  assert.match(page, /MaxKbDocumentUploadWorkbench/)
  assert.match(page, /openUploadWorkbench/)
  assert.match(page, /view === 'upload'/)
  assert.doesNotMatch(page, /title=\{`上传文档到/)
  assert.doesNotMatch(page, /模型 ID 请填写 MaxKB 模型管理中的模型 ID/)
  assert.doesNotMatch(page, /<Input[\s\S]*placeholder="填写 MaxKB LLM 模型 ID"/)
})

test('upload layout keeps footer reachable and releases width on mobile', () => {
  assert.match(appCss, /\.mkb-knowledge-page\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;/)
  assert.match(appCss, /\.mkb-knowledge-main\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*min-height:\s*0;/)
  assert.match(appCss, /\.mkb-view--upload\s*\{[\s\S]*flex:\s*1;[\s\S]*min-height:\s*0;/)
  assert.match(appCss, /\.mkb-upload-workbench\s*\{[\s\S]*overflow:\s*hidden;/)
  assert.match(appCss, /\.mkb-upload-rule-list,\s*\.mkb-upload-preview\s*\{[\s\S]*overflow:\s*auto;/)
  assert.match(appCss, /@media \(max-width: 768px\)\s*\{[\s\S]*\.mkb-knowledge-page\s*\{[\s\S]*grid-template-columns:\s*1fr;/)
  assert.match(appCss, /@media \(max-width: 768px\)\s*\{[\s\S]*\.mkb-knowledge-sidebar\s*\{[\s\S]*display:\s*none;/)
  assert.match(appCss, /@media \(max-width: 768px\)\s*\{[\s\S]*\.mkb-upload-footer\s*\{[\s\S]*position:\s*sticky;[\s\S]*bottom:\s*0;/)
  assert.match(cockpitCss, /\.admin-page-frame:has\(>\s*\.admin-page-frame__body\s*>\s*\.mkb-knowledge-page\)\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\);[\s\S]*min-height:\s*0;/)
  assert.match(cockpitCss, /\.admin-page-frame:has\(>\s*\.admin-page-frame__body\s*>\s*\.mkb-knowledge-page\)\s*>\s*\.admin-page-frame__body\s*\{[\s\S]*min-height:\s*0;/)
})
