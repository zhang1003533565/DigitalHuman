import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('VoiceScriptPage.tsx', import.meta.url), 'utf8')
const api = readFileSync(new URL('../../api/voiceScripts.ts', import.meta.url), 'utf8')

assert.match(api, /replaceAll: boolean/)
assert.match(api, /formData\.append\('replaceAll', String\(replaceAll\)\)/)
assert.match(page, /import axios from 'axios'/)
assert.match(page, /function voiceScriptErrorMessage/)
assert.match(page, /axios\.isAxiosError\(error\)/)
assert.match(page, /无法连接后端服务，请确认 backend-java 已启动/)
assert.match(page, /DOCX导入失败：\$\{voiceScriptErrorMessage/)
assert.match(page, /发布失败：\$\{voiceScriptErrorMessage/)
assert.match(page, /删除失败：\$\{voiceScriptErrorMessage/)
assert.match(page, /保存失败：\$\{voiceScriptErrorMessage/)
assert.match(page, /请补全必填项，并确认口播文本在100到1200字之间/)
assert.match(page, /form\.scrollToField\(firstFieldName\)/)
assert.match(page, /form\.resetFields\(\)/)
assert.match(page, /sourceFile: '手工新增'/)
assert.match(page, /const \[replaceAll, setReplaceAll\] = useState\(true\)/)
assert.match(page, /checkedChildren="清空旧口播"/)
assert.match(page, /unCheckedChildren="追加"/)

console.log('voice script interaction feedback contract passed')
