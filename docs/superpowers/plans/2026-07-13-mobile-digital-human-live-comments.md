# 移动数字人直播评论流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将数字人页面的移动端常驻聊天卡片改为数字人主舞台、左下角最近消息评论流、底部轻量互动栏和按需历史/设置面板，同时保持桌面端现状。

**Architecture:** 新建纯函数模块维护移动评论数量和快捷提问，`DigitalHumanPage` 继续持有唯一会话、语音和模型状态。移动视图作为同一页面内的响应式展示层读取现有状态；桌面聊天与移动历史面板复用同一个消息条目组件，避免复制推荐结果逻辑。

**Tech Stack:** React 19、TypeScript、CSS 媒体查询、Web Speech API、Node `assert` 契约测试、ESLint、Vite。

## Global Constraints

- `max-width: 768px` 使用直播评论流布局；桌面端保留当前完整聊天布局。
- 移动评论流只展示最近 5 条，不创建内部纵向滚动。
- 快捷问题固定为 `景点讲解`、`路线推荐`、`附近服务`，调用现有 `sendQuestion`。
- 完整历史面板最大高度为可视区域的 72%，设置和历史面板必须有界滚动。
- 移动互动栏位于固定底部导航上方，触控目标不小于 44px。
- 移动设置面板继续提供厂家、音色、模型选择；不改变现有存储和切换逻辑。
- 页面级纵向滚动所有者仍然只有 `.authenticated-app__content`。
- 不增加依赖，不修改后端协议，不改变桌面页面行为。
- 按用户要求不打开浏览器，使用代码契约、Lint 和生产构建验证。

---

### Task 1: 移动评论数据契约

**Files:**
- Create: `frontend-visitor/src/digitalHuman/mobileLive.ts`
- Create: `frontend-visitor/src/digitalHuman/mobileLive.test.mjs`

**Interfaces:**
- Consumes: 任意只读消息数组。
- Produces: `MOBILE_LIVE_COMMENT_LIMIT`、`MOBILE_LIVE_QUICK_QUESTIONS`、`getRecentMobileLiveComments<T>(messages)`。

- [ ] **Step 1: 写失败的纯函数测试**

  创建 `mobileLive.test.mjs`，先读取编译后的模块并断言限制、顺序和不变性：

  ```js
  import assert from 'node:assert/strict'
  import { execFileSync } from 'node:child_process'
  import { mkdtempSync, readFileSync } from 'node:fs'
  import { tmpdir } from 'node:os'
  import { dirname, join } from 'node:path'
  import { pathToFileURL } from 'node:url'
  import { fileURLToPath } from 'node:url'

  const sourceRoot = dirname(fileURLToPath(import.meta.url))
  const outDir = mkdtempSync(join(tmpdir(), 'digital-human-mobile-live-'))
  execFileSync('npx', [
    'tsc',
    join(sourceRoot, 'mobileLive.ts'),
    '--target', 'ES2022',
    '--module', 'ES2022',
    '--moduleResolution', 'bundler',
    '--ignoreConfig',
    '--skipLibCheck',
    '--outDir', outDir,
  ], { cwd: join(sourceRoot, '..', '..') })

  const modulePath = join(outDir, 'mobileLive.js')
  assert.ok(readFileSync(modulePath, 'utf8').length > 0)
  const mobileLive = await import(pathToFileURL(modulePath))

  assert.equal(mobileLive.MOBILE_LIVE_COMMENT_LIMIT, 5)
  assert.deepEqual(
    mobileLive.MOBILE_LIVE_QUICK_QUESTIONS.map((item) => item.label),
    ['景点讲解', '路线推荐', '附近服务'],
  )

  const messages = Array.from({ length: 8 }, (_, index) => ({ id: String(index + 1) }))
  const recent = mobileLive.getRecentMobileLiveComments(messages)
  assert.deepEqual(recent.map((item) => item.id), ['4', '5', '6', '7', '8'])
  assert.equal(messages.length, 8, 'deriving live comments must not mutate message state')
  console.log('mobile digital-human live data contract passed')
  ```

- [ ] **Step 2: 运行测试确认失败**

  Run: `cd frontend-visitor && node src/digitalHuman/mobileLive.test.mjs`

  Expected: FAIL，提示 `mobileLive.ts` 不存在或导出缺失。

- [ ] **Step 3: 实现评论限制和快捷提问**

  创建 `mobileLive.ts`：

  ```ts
  export const MOBILE_LIVE_COMMENT_LIMIT = 5

  export const MOBILE_LIVE_QUICK_QUESTIONS = [
    { label: '景点讲解', question: '请为我讲解灵山胜境的核心景点。' },
    { label: '路线推荐', question: '请根据当前时间为我推荐一条游览路线。' },
    { label: '附近服务', question: '请告诉我附近有哪些停车、餐饮和卫生间服务。' },
  ] as const

  export function getRecentMobileLiveComments<T>(messages: readonly T[]) {
    return messages.slice(-MOBILE_LIVE_COMMENT_LIMIT)
  }
  ```

- [ ] **Step 4: 运行纯函数测试确认通过**

  Run: `cd frontend-visitor && node src/digitalHuman/mobileLive.test.mjs`

  Expected: `mobile digital-human live data contract passed`。

- [ ] **Step 5: 提交数据契约**

  ```bash
  git add frontend-visitor/src/digitalHuman/mobileLive.ts frontend-visitor/src/digitalHuman/mobileLive.test.mjs
  git commit -m "feat: 增加移动数字人评论流数据契约"
  ```

---

### Task 2: 移动直播评论交互层

**Files:**
- Modify: `frontend-visitor/src/pages/DigitalHumanPage.tsx`
- Create: `frontend-visitor/src/pages/DigitalHumanPage.mobile-live.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `MOBILE_LIVE_QUICK_QUESTIONS` 与 `getRecentMobileLiveComments`；现有 `messages`、`draft`、`sendQuestion`、模型和音色选择处理函数。
- Produces: `.digital-human-mobile-live`、`.digital-mobile-comment-feed`、`.digital-mobile-composer`、`.digital-mobile-history`、`.digital-mobile-settings` DOM 契约。

- [ ] **Step 1: 写失败的移动交互源码契约**

  创建 `DigitalHumanPage.mobile-live.test.mjs`：

  ```js
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
  assert.match(page, /MOBILE_LIVE_QUICK_QUESTIONS\.map/[\s\S]*sendQuestion\(item\.question\)/)
  assert.match(page, /placeholder="问问灵灵…"/)
  assert.match(page, /startVoiceQuestion/)
  assert.match(page, /role="dialog"[\s\S]*aria-modal="true"/)
  assert.match(page, /event\.key === 'Escape'/)
  assert.match(page, /historyTriggerRef\.current\?\.focus\(\)/)
  assert.match(page, /settingsTriggerRef\.current\?\.focus\(\)/)
  assert.match(page, /className="digital-human-chat"/, 'desktop chat remains rendered')
  console.log('mobile digital-human live interaction contract passed')
  ```

- [ ] **Step 2: 运行契约确认失败**

  Run: `cd frontend-visitor && node src/pages/DigitalHumanPage.mobile-live.test.mjs`

  Expected: FAIL，缺少移动评论流结构。

- [ ] **Step 3: 提取可复用消息条目组件**

  在 `DigitalHumanPage.tsx` 的 `DigitalHumanPage` 之前增加内部组件，并用它替换桌面消息循环；移动历史面板也复用该组件：

  ```tsx
  type DigitalChatMessageArticleProps = {
    message: DigitalChatMessage
    onSuggestion: (suggestion: string) => void
  }

  function DigitalChatMessageArticle({ message, onSuggestion }: DigitalChatMessageArticleProps) {
    const isOwn = message.sender === 'me'
    return (
      <article className={isOwn ? 'digital-chat-message digital-chat-message--own' : 'digital-chat-message'}>
        {!isOwn ? <span className="digital-chat-message__avatar" aria-hidden>灵</span> : null}
        <div className="digital-chat-message__bubble">
          <div className="digital-chat-message__content">{message.content}</div>
          {message.result ? (
            <GuideResultCards result={message.result} messageId={message.messageId} onSuggestion={onSuggestion} />
          ) : null}
        </div>
        <time className="digital-chat-message__time">{formatChatTime(message.time)}</time>
        {isOwn ? <span className="digital-chat-message__avatar digital-chat-message__avatar--own" aria-hidden>我</span> : null}
      </article>
    )
  }
  ```

  桌面与历史面板统一传入：

  ```tsx
  onSuggestion={(suggestion) => {
    setDraft(suggestion)
    void sendQuestion(suggestion)
  }}
  ```

- [ ] **Step 4: 增加面板、焦点和语音识别状态**

  在页面状态区增加：

  ```tsx
  const historyTriggerRef = useRef<HTMLButtonElement | null>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const historyPanelRef = useRef<HTMLDivElement | null>(null)
  const settingsPanelRef = useRef<HTMLDivElement | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const recognitionGenerationRef = useRef(0)
  const [isMobileHistoryOpen, setMobileHistoryOpen] = useState(false)
  const [isMobileSettingsOpen, setMobileSettingsOpen] = useState(false)
  const [mobileHistoryTargetId, setMobileHistoryTargetId] = useState<string | null>(null)
  ```

  复用 `LiveBroadcastPage` 的接口定义与生命周期：

  ```tsx
  type SpeechRecognitionResultEvent = Event & { results: { 0: { 0: { transcript: string } } } }
  type SpeechRecognitionLike = {
    lang: string
    interimResults: boolean
    start: () => void
    stop?: () => void
    abort?: () => void
    onresult: ((event: SpeechRecognitionResultEvent) => void) | null
    onerror: (() => void) | null
  }
  type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
  ```

  ```tsx
  function startVoiceQuestion() {
    const SpeechRecognition = (window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }).SpeechRecognition ?? (window as typeof window & {
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setRuntimeState('error')
      setStatus('当前浏览器未提供语音识别，请使用文字提问。')
      return
    }
    recognitionGenerationRef.current += 1
    const generation = recognitionGenerationRef.current
    recognitionRef.current?.abort?.()
    recognitionRef.current?.stop?.()
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.onresult = (event) => {
      if (recognitionGenerationRef.current === generation) setDraft(event.results[0][0].transcript)
    }
    recognition.onerror = () => {
      if (recognitionGenerationRef.current === generation) setStatus('没有识别到语音，请重试或使用文字提问。')
    }
    try {
      recognition.start()
      setRuntimeState('listening')
      setStatus('正在聆听您的问题…')
    } catch {
      recognitionRef.current = null
      recognitionGenerationRef.current += 1
      setRuntimeState('error')
      setStatus('语音识别启动失败，请重试或使用文字提问。')
    }
  }
  ```

  卸载时增加 `recognitionGenerationRef.current += 1` 与 `recognitionRef.current?.abort?.()`。

- [ ] **Step 5: 实现面板关闭与焦点恢复**

  ```tsx
  function openMobileHistory(messageId?: string) {
    setMobileHistoryTargetId(messageId ?? null)
    setMobileHistoryOpen(true)
  }

  function closeMobileHistory() {
    setMobileHistoryOpen(false)
    window.requestAnimationFrame(() => historyTriggerRef.current?.focus())
  }

  function closeMobileSettings() {
    setMobileSettingsOpen(false)
    window.requestAnimationFrame(() => settingsTriggerRef.current?.focus())
  }

  useEffect(() => {
    if (!isMobileHistoryOpen && !isMobileSettingsOpen) return
    const panel = isMobileHistoryOpen ? historyPanelRef.current : settingsPanelRef.current
    panel?.querySelector<HTMLElement>('button, input, textarea, [tabindex]:not([tabindex="-1"])')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isMobileHistoryOpen) closeMobileHistory()
        if (isMobileSettingsOpen) closeMobileSettings()
        return
      }
      if (event.key === 'Tab' && panel) {
        const focusable = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMobileHistoryOpen, isMobileSettingsOpen])

  useEffect(() => {
    if (!isMobileHistoryOpen || !mobileHistoryTargetId) return
    window.requestAnimationFrame(() => {
      document.getElementById(`mobile-history-${mobileHistoryTargetId}`)?.scrollIntoView({ block: 'center' })
    })
  }, [isMobileHistoryOpen, mobileHistoryTargetId])
  ```

- [ ] **Step 6: 渲染移动直播层**

  在状态层之后、桌面 `<aside className="digital-human-chat">` 之前渲染：

  ```tsx
  <section className="digital-human-mobile-live" aria-label="灵山数字人直播导览">
    <button ref={settingsTriggerRef} className="digital-mobile-settings-trigger" type="button" onClick={() => setMobileSettingsOpen(true)} aria-label="打开数字人设置">设置</button>
    <span className="sr-only" aria-live="polite" aria-atomic="true">
      {messages.at(-1)?.content}
    </span>
    <section className="digital-mobile-comment-feed" aria-label="最近对话">
      {getRecentMobileLiveComments(messages).map((message) => (
        <article key={message.id} className={`digital-mobile-comment digital-mobile-comment--${message.sender}`}>
          <strong>{message.sender === 'guide' ? '灵灵' : '我'}</strong>
          <span>{message.content}</span>
          {message.result ? <button type="button" onClick={() => openMobileHistory(message.id)}>查看推荐</button> : null}
        </article>
      ))}
      <button ref={historyTriggerRef} className="digital-mobile-comment-feed__open" type="button" onClick={() => openMobileHistory()}>查看全部</button>
    </section>
    <div className="digital-mobile-quick-questions" aria-label="快捷提问">
      {MOBILE_LIVE_QUICK_QUESTIONS.map((item) => (
        <button key={item.label} type="button" disabled={!isReady} onClick={() => void sendQuestion(item.question)}>{item.label}</button>
      ))}
    </div>
    <form className="digital-mobile-composer" onSubmit={handleSend}>
      <textarea
        value={draft}
        placeholder="问问灵灵…"
        rows={1}
        disabled={!isReady}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void handleSend()
          }
        }}
      />
      <button type="button" onClick={startVoiceQuestion} disabled={!isReady || isSpeaking} aria-label="语音提问">语音</button>
      <button type="submit" disabled={!canSend}>发送</button>
    </form>
  </section>
  ```

  同级渲染两个底部面板；遮罩只在点击自身时关闭，面板内部点击不得冒泡关闭：

  ```tsx
  {isMobileHistoryOpen ? (
    <div className="digital-mobile-sheet" onMouseDown={(event) => {
      if (event.currentTarget === event.target) closeMobileHistory()
    }}>
      <section ref={historyPanelRef} className="digital-mobile-sheet__panel digital-mobile-history" role="dialog" aria-modal="true" aria-labelledby="mobile-history-title">
        <header className="digital-mobile-sheet__header">
          <div><h2 id="mobile-history-title">完整对话</h2><span>{messages.length} 条消息</span></div>
          <button type="button" onClick={closeMobileHistory} aria-label="关闭完整对话">关闭</button>
        </header>
        <div className="digital-mobile-history__body">
          {messages.map((message) => (
            <div id={`mobile-history-${message.id}`} key={message.id}>
              <DigitalChatMessageArticle message={message} onSuggestion={(suggestion) => {
                setDraft(suggestion)
                closeMobileHistory()
                void sendQuestion(suggestion)
              }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  ) : null}

  {isMobileSettingsOpen ? (
    <div className="digital-mobile-sheet" onMouseDown={(event) => {
      if (event.currentTarget === event.target) closeMobileSettings()
    }}>
      <section ref={settingsPanelRef} className="digital-mobile-sheet__panel digital-mobile-settings" role="dialog" aria-modal="true" aria-labelledby="mobile-settings-title">
        <header className="digital-mobile-sheet__header">
          <h2 id="mobile-settings-title">数字人设置</h2>
          <button type="button" onClick={closeMobileSettings} aria-label="关闭数字人设置">关闭</button>
        </header>
        <div className="digital-mobile-settings__body">
          <fieldset><legend>服务来源</legend>{FACTORY_OPTIONS.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === selectedFactory.id} disabled={isSpeaking} onClick={() => handleSelectFactory(item.id)}>{item.name}</button>
          ))}</fieldset>
          <fieldset><legend>播报音色</legend>{VOICE_OPTIONS.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === selectedVoice.id} disabled={isSpeaking} onClick={() => handleSelectVoice(item.id)}>{item.name}</button>
          ))}</fieldset>
          <fieldset><legend>数字人模型</legend>{MODEL_OPTIONS.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === selectedModel.id} disabled={isSpeaking} onClick={() => handleSelectModel(item.id)}>{item.name}</button>
          ))}</fieldset>
        </div>
      </section>
    </div>
  ) : null}
  ```

- [ ] **Step 7: 运行交互契约和 TypeScript**

  Run:

  ```bash
  cd frontend-visitor
  node src/pages/DigitalHumanPage.mobile-live.test.mjs
  npx tsc -b
  ```

  Expected: 契约输出 `mobile digital-human live interaction contract passed`，TypeScript 零错误。

- [ ] **Step 8: 提交移动互动结构**

  ```bash
  git add frontend-visitor/src/pages/DigitalHumanPage.tsx frontend-visitor/src/pages/DigitalHumanPage.mobile-live.test.mjs
  git commit -m "feat: 增加移动数字人直播评论交互"
  ```

---

### Task 3: 移动直播视觉与滚动边界

**Files:**
- Modify: `frontend-visitor/src/pages/DigitalHumanPage.css`
- Modify: `frontend-visitor/src/responsive.test.mjs`

**Interfaces:**
- Consumes: Task 2 的移动直播 DOM 类名。
- Produces: 直播舞台布局、评论流、快捷问题、互动栏、历史和设置底部面板的移动样式。

- [ ] **Step 1: 写失败的响应式契约**

  在 `responsive.test.mjs` 中删除原有“移动聊天卡片位于第二网格行”和“移动聊天 body 常驻限高”的断言，并替换为：

  ```js
  assert.match(digitalMobile, /\.digital-human-chat\s*\{[^}]*display:\s*none/s, 'mobile hides the desktop chat card')
  assert.match(digitalMobile, /\.digital-human-mobile-live\s*\{[^}]*display:\s*block/s, 'mobile shows the live comment experience')
  assert.match(digitalMobile, /\.digital-mobile-comment-feed\s*\{[^}]*overflow:\s*visible/s, 'live comments never become a nested scroller')
  assert.match(digitalMobile, /\.digital-mobile-quick-questions\s*\{[^}]*overflow-x:\s*auto[^}]*overflow-y:\s*hidden/s, 'quick questions keep horizontal-only scrolling')
  assert.match(digitalMobile, /\.digital-mobile-composer\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*calc\(var\(--mobile-nav-height\)/s, 'mobile composer stays above bottom navigation')
  assert.match(digitalMobile, /\.digital-mobile-history__body,[\s\S]*\.digital-mobile-settings__body\s*\{[^}]*max-height:[^;}]+;[^}]*overflow-y:\s*auto/s, 'mobile sheets keep bounded local scrolling')
  assert.match(digitalMobile, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.digital-mobile-comment/s, 'comment motion respects reduced-motion preferences')
  ```

  将 `.digital-mobile-history__body` 与 `.digital-mobile-settings__body` 加入滚动白名单，并要求所有代表宽度的 computed `overflow-y` 为 `auto` 且 `max-height` 有限。

- [ ] **Step 2: 运行响应式测试确认失败**

  Run: `cd frontend-visitor && node src/responsive.test.mjs`

  Expected: FAIL，移动直播样式尚不存在。

- [ ] **Step 3: 增加默认隐藏和移动显示边界**

  在基础样式中增加：

  ```css
  .digital-human-mobile-live,
  .digital-mobile-sheet {
    display: none;
  }
  ```

  在最终 `@media (max-width: 768px)` 中，将 `.live2d-page` 改为单舞台布局，并隐藏桌面聊天：

  ```css
  .live2d-page {
    display: block;
    min-height: max(620px, calc(100dvh - 56px - var(--mobile-nav-height) - var(--safe-bottom)));
    overflow: hidden;
  }

  .digital-human-chat {
    display: none;
  }

  .digital-human-mobile-live {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: block;
    pointer-events: none;
  }

  .digital-human-status {
    top: 12px;
    right: auto;
    bottom: auto;
    left: 12px;
    width: fit-content;
    max-width: calc(100% - 112px);
    min-height: 36px;
    padding: 8px 12px;
  }

  .digital-mobile-settings-trigger {
    position: absolute;
    top: 12px;
    right: 12px;
    min-width: var(--touch-target);
    min-height: var(--touch-target);
    border: 1px solid rgba(125, 204, 255, 0.3);
    border-radius: 999px;
    color: #fff;
    background: rgba(3, 14, 31, 0.7);
    pointer-events: auto;
  }
  ```

- [ ] **Step 4: 实现评论流、快捷问题与互动栏样式**

  ```css
  .digital-mobile-comment-feed {
    position: absolute;
    right: 14px;
    bottom: 154px;
    left: 14px;
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
    max-height: 210px;
    padding: 0;
    overflow: visible;
    color: #fff;
    text-align: left;
    border: 0;
    background: transparent;
    pointer-events: auto;
  }

  .digital-mobile-comment {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 6px;
    max-width: min(88%, 340px);
    padding: 7px 10px;
    border-radius: 12px;
    background: rgba(3, 12, 28, 0.58);
    backdrop-filter: blur(10px);
    animation: digital-mobile-comment-in 180ms ease-out both;
  }

  .digital-mobile-comment:nth-last-of-type(4) { opacity: 0.46; }
  .digital-mobile-comment:nth-last-of-type(3) { opacity: 0.62; }
  .digital-mobile-comment:nth-last-of-type(2) { opacity: 0.8; }

  @keyframes digital-mobile-comment-in {
    from { opacity: 0; transform: translateY(8px); }
    to { transform: translateY(0); }
  }

  .digital-mobile-comment > span {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
  }

  .digital-mobile-quick-questions {
    position: absolute;
    right: 12px;
    bottom: 92px;
    left: 12px;
    display: flex;
    gap: 8px;
    overflow-x: auto;
    overflow-y: hidden;
    pointer-events: auto;
  }

  .digital-mobile-composer {
    position: fixed;
    right: 10px;
    bottom: calc(var(--mobile-nav-height) + var(--safe-bottom) + 8px);
    left: 10px;
    z-index: 900;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 44px 52px;
    gap: 6px;
    padding: 7px;
    border: 1px solid rgba(125, 204, 255, 0.28);
    border-radius: 24px;
    background: rgba(3, 14, 31, 0.88);
    backdrop-filter: blur(18px);
    pointer-events: auto;
  }
  ```

  所有按钮和输入设置 `min-height: var(--touch-target)`，不得使用手绘 SVG 或新增图标依赖。

- [ ] **Step 5: 实现历史与设置底部面板**

  ```css
  .digital-mobile-sheet {
    position: fixed;
    inset: 56px 0 calc(var(--mobile-nav-height) + var(--safe-bottom)) 0;
    z-index: 920;
    display: grid;
    align-items: end;
    background: rgba(0, 5, 14, 0.48);
  }

  .digital-mobile-sheet__panel {
    max-height: 72dvh;
    border: 1px solid rgba(125, 204, 255, 0.24);
    border-radius: 24px 24px 0 0;
    background: rgba(4, 18, 39, 0.98);
    box-shadow: 0 -24px 70px rgba(0, 0, 0, 0.46);
  }

  .digital-mobile-history__body,
  .digital-mobile-settings__body {
    max-height: calc(72dvh - 68px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    touch-action: pan-y;
  }
  ```

  面板内部设置 16px 左右安全间距，关闭按钮至少 44px；设置选项使用一列或两列自适应网格。

- [ ] **Step 6: 增加动画降级**

  ```css
  @media (max-width: 768px) and (prefers-reduced-motion: reduce) {
    .digital-mobile-comment,
    .digital-mobile-sheet__panel {
      animation: none;
      transition: none;
    }
  }
  ```

- [ ] **Step 7: 运行目标测试与构建**

  Run:

  ```bash
  cd frontend-visitor
  node src/digitalHuman/mobileLive.test.mjs
  node src/pages/DigitalHumanPage.mobile-live.test.mjs
  node src/responsive.test.mjs
  npm run lint
  npm run build
  ```

  Expected: 三个目标测试、ESLint、TypeScript 和 Vite build 全部通过。

- [ ] **Step 8: 提交移动直播样式**

  ```bash
  git add frontend-visitor/src/pages/DigitalHumanPage.css frontend-visitor/src/responsive.test.mjs
  git commit -m "style: 重构移动数字人直播评论布局"
  ```

---

### Task 4: 完整回归与交付验证

**Files:**
- Modify only if failures prove necessary: files changed in Tasks 1–3.

**Interfaces:**
- Consumes: Tasks 1–3 的完整移动直播体验。
- Produces: 可交付的测试、Lint、类型检查和生产构建证据。

- [ ] **Step 1: 运行全部游客端 Node 测试**

  Run:

  ```bash
  cd frontend-visitor
  for test_file in $(find src -name '*.test.mjs' -print | sort); do
    node "$test_file" || exit 1
  done
  ```

  Expected: 包含新增移动直播测试在内的全部测试通过。

- [ ] **Step 2: 运行静态与生产验证**

  Run:

  ```bash
  cd frontend-visitor
  npm run lint
  npm run build
  cd ..
  git diff --check
  git status --short
  ```

  Expected: ESLint、TypeScript、Vite build 和 diff 检查通过；工作树干净。

- [ ] **Step 3: 独立审查完整差异**

  审查范围从计划基线到最终提交，必须确认：

  - 移动端默认不显示桌面聊天卡片。
  - 最近 5 条评论、快捷提问、文本发送和语音输入均复用同一会话。
  - 两个底部面板可关闭、可恢复焦点，且不裁剪推荐结果或设置选项。
  - 移动滚动白名单仅增加两个明确限高面板；评论流和快捷轨道不成为纵向滚动容器。
  - 桌面 `.digital-human-chat`、模型加载、TTS 和流式回答无回归。

- [ ] **Step 4: 修复审查中的阻塞项并重复验证**

  对 Critical/Important 问题执行目标测试、全量测试、Lint、build 和二次审查；Minor 仅在低风险且不扩范围时修复，否则记录。

- [ ] **Step 5: 完成交付**

  最终报告列出主要移动交互变化、提交、全量验证结果，以及“按用户要求未打开浏览器”的视觉验证限制。
