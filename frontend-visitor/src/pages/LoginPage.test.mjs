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

const authFieldWrappers = source.match(/className="auth-field"/g) ?? []
assert.equal(authFieldWrappers.length, 4, 'each authentication field must own a stable field-and-error wrapper')
assert.match(source, /className="auth-field">\s*<label className="auth-input">[\s\S]*?fieldErrors\.username \? <p className="field-message">/)
assert.match(source, /className="auth-field">\s*<label className="auth-input">[\s\S]*?fieldErrors\.displayName \? <p className="field-message">/)
assert.match(source, /className="auth-field">\s*<label className="auth-input">[\s\S]*?fieldErrors\.password \? <p className="field-message">/)
assert.match(source, /className="auth-field">\s*<label className="auth-input">[\s\S]*?fieldErrors\.confirmPassword \? <p className="field-message">/)
assert.doesNotMatch(source, /auth-checkbox|remember|记住登录|记住状态/, 'login form must not add a remember-login field')
assert.match(source, /没有账号？去注册[\s\S]*auth-submit-button auth-submit-button--inline/, 'login keeps registration link and submit action')

console.log('login viewport contract passed')
