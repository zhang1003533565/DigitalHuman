import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const page = readFileSync(join(root, 'DigitalHumanPage.tsx'), 'utf8')

assert.match(page, /getRecentMobileLiveComments\(messages\)/)
assert.match(page, /className="digital-human-mobile-live"/)
assert.match(page, /className="digital-mobile-comment-feed"/)
assert.match(page, /className="sr-only"[\s\S]*aria-live="polite"/)
assert.match(page, /MOBILE_LIVE_QUICK_QUESTIONS\.map[\s\S]*sendQuestion\(item\.question\)/)
assert.match(page, /placeholder="问问灵灵…"/)
assert.match(page, /startVoiceQuestion/)
assert.match(page, /role="dialog"[\s\S]*aria-modal="true"/)
assert.match(page, /event\.key === 'Escape'/)
assert.match(page, /mobileHistoryReturnFocusRef = useRef<HTMLElement \| null>\(null\)/)
assert.match(page, /mobileHistoryReturnFocusRef\.current = trigger/)
assert.match(page, /openMobileHistory\(message\.id, event\.currentTarget\)/)
assert.match(page, /openMobileHistory\(undefined, event\.currentTarget\)/)
assert.match(page, /mobileHistoryReturnFocusRef\.current\?\.focus\(\)/)
assert.doesNotMatch(page, /historyTriggerRef/)
assert.match(page, /settingsTriggerRef\.current\?\.focus\(\)/)
assert.match(page, /MOBILE_DIALOG_FOCUSABLE_SELECTOR[\s\S]*a\[href\]:not\(\[tabindex="-1"\]\)/)
assert.match(page, /MOBILE_DIALOG_FOCUSABLE_SELECTOR[\s\S]*button:not\(:disabled\):not\(\[tabindex="-1"\]\)/)
assert.match(page, /MOBILE_DIALOG_FOCUSABLE_SELECTOR[\s\S]*input:not\(:disabled\):not\(\[tabindex="-1"\]\)/)
assert.match(page, /MOBILE_DIALOG_FOCUSABLE_SELECTOR[\s\S]*select:not\(:disabled\):not\(\[tabindex="-1"\]\)/)
assert.match(page, /MOBILE_DIALOG_FOCUSABLE_SELECTOR[\s\S]*textarea:not\(:disabled\):not\(\[tabindex="-1"\]\)/)
assert.match(page, /querySelector<HTMLElement>\(MOBILE_DIALOG_FOCUSABLE_SELECTOR\)/)
assert.match(page, /querySelectorAll<HTMLElement>\(MOBILE_DIALOG_FOCUSABLE_SELECTOR\)/)
assert.match(page, /matchMedia\('\(min-width: 769px\)'\)[\s\S]*messagesEndRef\.current\?\.scrollIntoView/)
assert.match(page, /className="digital-human-chat"/, 'desktop chat remains rendered')
console.log('mobile digital-human live interaction contract passed')
