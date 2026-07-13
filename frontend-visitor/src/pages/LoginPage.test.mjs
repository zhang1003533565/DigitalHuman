import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./LoginPage.tsx', import.meta.url)), 'utf8')

assert.match(source, /const authScreenRef = useRef<HTMLElement \| null>\(null\)/)
assert.match(source, /ref=\{authScreenRef\}/)
assert.match(source, /const viewport = window\.visualViewport/)
assert.match(source, /viewport\?\.height \?\? window\.innerHeight/)
assert.match(source, /viewport\?\.offsetTop \?\? 0/)
assert.match(source, /setProperty\('--login-viewport-height', `\$\{viewportHeight\}px`\)/)
assert.match(source, /setProperty\('--login-viewport-offset-top', `\$\{viewportOffsetTop\}px`\)/)
assert.match(source, /viewport\?\.addEventListener\('resize', syncViewport\)/)
assert.match(source, /viewport\?\.addEventListener\('scroll', syncViewport\)/)
assert.match(source, /window\.addEventListener\('resize', syncViewport\)/)
assert.match(source, /viewport\?\.removeEventListener\('resize', syncViewport\)/)
assert.match(source, /viewport\?\.removeEventListener\('scroll', syncViewport\)/)
assert.match(source, /window\.removeEventListener\('resize', syncViewport\)/)

console.log('login viewport contract passed')
