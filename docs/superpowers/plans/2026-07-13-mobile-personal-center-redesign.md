# Mobile Personal Center Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将会话历史、反馈记录和个人资料重设计为正常手机应用尺度的三个独立移动页面。

**Architecture:** 每个页面保留桌面结构和既有数据源，同时增加语义明确的移动结构类名与移动专属排版。会话历史负责异步消息时间线，反馈记录负责可展开提交与记录详情，个人资料负责只读身份档案；全局仍由 `authenticated-app__content` 单独承担滚动。

**Tech Stack:** React 19、TypeScript 6、Axios、React Router 7、CSS、Node.js `assert` 契约测试、Vite 8。

## Global Constraints

- 仅重设计移动端，桌面端现有布局和行为保持不变。
- 不新增用户资料、统计、收藏或反馈后端接口。
- 不创建新的详情路由，不修改全局导航菜单结构。
- 页面左右边距 14px，区块间距 12px，普通卡片内边距 14–16px、圆角 14–16px。
- 页面标题 22–24px，区块标题 15–17px，正文 13–14px，辅助文字 11–12px。
- 交互控件最小触控区域 44×44px。
- 三个页面只允许 `.authenticated-app__content` 负责纵向滚动，不得创建页面内部滚动容器。
- 竖屏验收 375×667、390×844、430×932；短横屏验收 844×390、932×430。
- 按用户要求不打开浏览器；真实设备视觉、软键盘和屏幕阅读器点验记录为非阻断缺口。
- 直接提交当前 `main`，不创建分支或 worktree。

---

## File Structure

- Create: `frontend-visitor/src/pages/HistoryPage.mobile.test.mjs` — 历史页状态、时间线和移动尺寸契约。
- Modify: `frontend-visitor/src/pages/HistoryPage.tsx` — 加载/失败/重试状态与角色消息流。
- Modify: `frontend-visitor/src/pages/HistoryPage.css` — 移动时间线与紧凑头部。
- Modify: `frontend-visitor/src/pages/FeedbackPage.test.mjs` — 扩展提交、刷新与记录展开契约。
- Modify: `frontend-visitor/src/pages/FeedbackPage.tsx` — 概览、折叠提交区和原位详情。
- Modify: `frontend-visitor/src/pages/FeedbackPage.css` — 紧凑表单、状态列表与详情。
- Create: `frontend-visitor/src/pages/ProfilePage.mobile.test.mjs` — 身份栏、2×2 统计和资料列表契约。
- Modify: `frontend-visitor/src/pages/ProfilePage.tsx` — 只读信息列表替代禁用输入框。
- Modify: `frontend-visitor/src/pages/ProfilePage.css` — 正常手机尺度的个人档案布局。
- Modify: `frontend-visitor/src/responsive.test.mjs` — 三页统一尺寸、单滚动所有者和短横屏回归。

---

### Task 1: 会话历史移动时间线

**Files:**
- Create: `frontend-visitor/src/pages/HistoryPage.mobile.test.mjs`
- Modify: `frontend-visitor/src/pages/HistoryPage.tsx`
- Modify: `frontend-visitor/src/pages/HistoryPage.css`

**Interfaces:**
- Consumes: sessionStorage 的 `digitalhuman.visitor.guideSessionId` 与现有消息接口。
- Produces: `history-mobile-head`、`history-timeline`、`history-message--user/assistant`，以及 `idle/loading/error` 状态和重试入口。

- [ ] **Step 1: 写入失败的历史页移动契约**

```js
assert.match(page, /const \[loadState, setLoadState\] = useState<'idle' \| 'loading' \| 'error'>\('idle'\)/)
assert.match(page, /const \[reloadKey, setReloadKey\] = useState\(0\)/)
assert.match(page, /new AbortController\(\)/)
assert.match(page, /signal:\s*controller\.signal/)
assert.match(page, /className="history-mobile-head"/)
assert.match(page, /className="history-timeline"/)
assert.match(page, /history-message--\$\{message\.role === 'user' \? 'user' : 'assistant'\}/)
assert.match(page, /会话记录加载失败[\s\S]*重试/)
assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.history-page\s*\{[^}]*--personal-mobile-edge:\s*14px/)
assert.match(css, /\.history-message__body\s*\{[^}]*overflow-wrap:\s*anywhere/)
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `cd frontend-visitor && node src/pages/HistoryPage.mobile.test.mjs`

Expected: FAIL，缺少加载状态和移动时间线结构。

- [ ] **Step 3: 实现可取消的加载状态**

```ts
const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle')
const [reloadKey, setReloadKey] = useState(0)

useEffect(() => {
  if (!sessionId) return
  const controller = new AbortController()
  setLoadState('loading')
  axios.get<GuideMessage[]>(`/api/user/guide/session/${sessionId}/messages`, { signal: controller.signal })
    .then(({ data }) => {
      setMessages(data)
      setLoadState('idle')
    })
    .catch((error) => {
      if (axios.isCancel(error)) return
      setLoadState('error')
    })
  return () => controller.abort()
}, [reloadKey, sessionId])
```

- [ ] **Step 4: 渲染移动头部、状态与时间线**

```tsx
<header className="history-mobile-head">
  <div><span>导览记录</span><h1>会话历史</h1></div>
  {sessionId ? <button type="button" onClick={() => navigate(`${DIGITAL_HUMAN_ROUTE}?sessionId=${encodeURIComponent(sessionId)}`)}>继续对话</button> : null}
</header>
<section className="history-timeline" aria-label="导览消息记录">
  {loadState === 'loading' ? <p className="history-state" role="status">正在加载会话记录…</p> : null}
  {loadState === 'error' ? <div className="history-state"><p>会话记录加载失败</p><button type="button" onClick={() => setReloadKey((value) => value + 1)}>重试</button></div> : null}
  {loadState === 'idle' ? messages.map((message) => (
    <article key={`${message.role}-${message.timestamp}`} className={`history-message history-message--${message.role === 'user' ? 'user' : 'assistant'}`}>
      <div className="history-message__meta"><span>{message.role === 'user' ? '我' : '灵灵'}</span><time>{formatMessageTime(message.timestamp)}</time></div>
      <p className="history-message__body">{message.content}</p>
    </article>
  )) : null}
</section>
```

无 `sessionId` 与有会话但 `messages.length === 0` 使用两个不同的 `.history-state` 文案。桌面 `.page-heading` 与 `.feature-grid` 可保留，通过移动 CSS 隐藏；移动结构通过 `min-width: 769px` 隐藏。

- [ ] **Step 5: 实现移动尺寸**

```css
.history-mobile-head,
.history-timeline { display: none; }

@media (max-width: 768px), (max-width: 932px) and (max-height: 520px) and (orientation: landscape) {
  .history-page { --personal-mobile-edge: 14px; }
  .history-page .page-heading,
  .history-page .feature-grid { display: none; }
  .history-mobile-head { display: flex; padding: 4px 2px; gap: 12px; }
  .history-mobile-head h1 { margin: 2px 0 0; font-size: 24px; }
  .history-timeline { display: grid; gap: 12px; }
  .history-message { max-width: 88%; padding: 14px; border-radius: 16px; }
  .history-message--user { justify-self: end; }
  .history-message--assistant { justify-self: start; }
  .history-message__body { margin: 6px 0 0; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; white-space: pre-wrap; }
}
```

- [ ] **Step 6: 运行测试和提交**

Run: `cd frontend-visitor && node src/pages/HistoryPage.mobile.test.mjs && node src/responsive.test.mjs`

Expected: PASS。

Commit: `feat: 重设计移动会话历史时间线`，使用仓库 Lore trailers，Tested 写明两个测试，Not-tested 写明未打开浏览器。

---

### Task 2: 反馈概览、折叠提交与详情列表

**Files:**
- Modify: `frontend-visitor/src/pages/FeedbackPage.test.mjs`
- Modify: `frontend-visitor/src/pages/FeedbackPage.tsx`
- Modify: `frontend-visitor/src/pages/FeedbackPage.css`

**Interfaces:**
- Consumes: 现有反馈查询/提交接口和 `FeedbackRecord`。
- Produces: `isComposerOpen`、`expandedRecordKeys: Set<string>`、`feedback-mobile-summary`、`feedback-composer`、`feedback-record`。

- [ ] **Step 1: 写入失败的反馈交互契约**

```js
assert.match(feedback, /const \[isComposerOpen, setIsComposerOpen\] = useState\(false\)/)
assert.match(feedback, /const \[expandedRecordKeys, setExpandedRecordKeys\] = useState<Set<string>>\(new Set\(\)\)/)
assert.match(feedback, /setReloadKey\(\(value\) => value \+ 1\)/)
assert.match(feedback, /setIsComposerOpen\(false\)/)
assert.match(feedback, /aria-expanded=\{expandedRecordKeys\.has\(recordKey\)\}/)
assert.match(feedback, /className="feedback-mobile-summary"/)
assert.match(feedback, /className="feedback-composer"/)
assert.match(feedbackCss, /\.feedback-record__summary\s*\{[^}]*min-height:\s*44px/)
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `cd frontend-visitor && node src/pages/FeedbackPage.test.mjs`

Expected: FAIL，缺少折叠提交与记录展开状态。

- [ ] **Step 3: 增加提交和展开状态**

```ts
const [isComposerOpen, setIsComposerOpen] = useState(false)
const [expandedRecordKeys, setExpandedRecordKeys] = useState<Set<string>>(new Set())

function toggleRecord(recordKey: string) {
  setExpandedRecordKeys((current) => {
    const next = new Set(current)
    if (next.has(recordKey)) next.delete(recordKey)
    else next.add(recordKey)
    return next
  })
}
```

提交成功顺序固定为 `setComment('')`、`setSubmitState('感谢反馈，已提交。')`、`setIsComposerOpen(false)`、`setReloadKey((value) => value + 1)`；失败只设置错误文案，不清空输入。

- [ ] **Step 4: 渲染概览、折叠提交区和记录详情**

```tsx
<header className="feedback-mobile-summary">
  <div><span>服务反馈</span><h1>反馈记录</h1></div>
  <dl><div><dt>本次记录</dt><dd>{records.length}</dd></div><div><dt>已处理</dt><dd>{records.filter((record) => record.status === 'RESOLVED').length}</dd></div></dl>
</header>
<section className={`feedback-composer${isComposerOpen ? ' feedback-composer--open' : ''}`}>
  <button type="button" className="feedback-composer__trigger" aria-expanded={isComposerOpen} onClick={() => setIsComposerOpen((open) => !open)}>提交新反馈</button>
  {isComposerOpen ? <div className="feedback-composer__body"><textarea value={comment} onChange={(event) => setComment(event.target.value)} /><div><button type="button" onClick={() => void submitGeneralFeedback()}>提交反馈</button><button type="button" onClick={() => setIsComposerOpen(false)}>取消</button></div></div> : null}
</section>
```

每条记录使用稳定 `recordKey = `${record.sessionId}-${record.createdAt}``，摘要按钮提供 `aria-expanded`、`aria-controls`，详情容器使用对应 `id`。状态、分类、评分、时间始终显示，回答、意见、处理状态和管理员备注仅在展开时显示。

- [ ] **Step 5: 实现移动尺寸与状态行**

```css
@media (max-width: 768px), (max-width: 932px) and (max-height: 520px) and (orientation: landscape) {
  .feedback-page .page-heading,
  .feedback-page > .page-content > .feature-card,
  .feedback-page .feature-grid { display: none; }
  .feedback-mobile { display: grid; gap: 12px; }
  .feedback-mobile-summary { padding: 4px 2px; }
  .feedback-mobile-summary h1 { margin: 2px 0 0; font-size: 24px; }
  .feedback-composer,
  .feedback-record { padding: 14px; border-radius: 16px; }
  .feedback-record__summary { min-height: 44px; }
  .feedback-record__body { font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
}
```

- [ ] **Step 6: 运行测试和提交**

Run: `cd frontend-visitor && node src/pages/FeedbackPage.test.mjs && node src/responsive.test.mjs`

Expected: PASS。

Commit: `feat: 重设计移动反馈记录交互`，使用 Lore trailers。

---

### Task 3: 个人数字档案

**Files:**
- Create: `frontend-visitor/src/pages/ProfilePage.mobile.test.mjs`
- Modify: `frontend-visitor/src/pages/ProfilePage.tsx`
- Modify: `frontend-visitor/src/pages/ProfilePage.css`

**Interfaces:**
- Consumes: `getStoredUser()` 与现有 `MOCK_STATS`。
- Produces: `profile-identity`、`profile-stats` 2×2、`profile-details` 只读列表。

- [ ] **Step 1: 写入失败的个人页契约**

```js
assert.match(page, /className="profile-identity"/)
assert.match(page, /className="profile-details"/)
assert.match(page, /<dt>用户名<\/dt>/)
assert.match(page, /<dt>显示名称<\/dt>/)
assert.match(page, /<dt>角色<\/dt>/)
assert.doesNotMatch(page, /className="profile-form__input"/)
assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.profile-stats\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
assert.match(css, /\.profile-stat-card\s*\{[^}]*min-height:\s*72px[^}]*max-height:\s*84px/)
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `cd frontend-visitor && node src/pages/ProfilePage.mobile.test.mjs`

Expected: FAIL，缺少新身份栏与资料列表。

- [ ] **Step 3: 重构语义结构**

```tsx
<section className="profile-grid">
  <aside className="profile-identity">
    <div className="profile-identity__avatar">{getInitials(user?.displayName || user?.username || '')}</div>
    <div className="profile-identity__meta"><h1>{user?.displayName || user?.username}</h1><span>@{user?.username}</span></div>
    <span className="profile-identity__role">{user?.role === 'ADMIN' ? '管理员' : '游客'}</span>
  </aside>
  <section className="profile-main">
    <section className="profile-stats" aria-label="游客数据">{MOCK_STATS.map((stat) => <article key={stat.label} className="profile-stat-card"><strong>{stat.value}</strong><span>{stat.label}</span></article>)}</section>
    <section className="profile-details"><h2>个人资料</h2><dl><div><dt>用户名</dt><dd>{user?.username || '未设置'}</dd></div><div><dt>显示名称</dt><dd>{user?.displayName || '未设置'}</dd></div><div><dt>角色</dt><dd>{user?.role === 'ADMIN' ? '管理员' : '游客'}</dd></div></dl><p>资料修改功能即将上线，敬请期待</p></section>
  </section>
</section>
```

桌面 `.profile-grid` 继续使用 `280px 1fr`，`.profile-identity` 在桌面保持原纵向头像卡视觉；只有移动媒体查询将其改为横向身份栏。

- [ ] **Step 4: 实现 2×2 和紧凑资料行**

```css
@media (max-width: 768px), (max-width: 932px) and (max-height: 520px) and (orientation: landscape) {
  .profile-grid { display: grid; gap: 12px; margin-top: 0; }
  .profile-identity { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 12px; padding: 14px; border-radius: 16px; }
  .profile-identity__avatar { width: 56px; height: 56px; }
  .profile-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .profile-stat-card { min-height: 72px; max-height: 84px; padding: 12px; border-radius: 14px; }
  .profile-details { padding: 14px; border-radius: 16px; }
  .profile-details dl > div { display: grid; grid-template-columns: 88px minmax(0, 1fr); padding: 12px 0; }
  .profile-details dd { margin: 0; overflow-wrap: anywhere; text-align: right; }
}
```

- [ ] **Step 5: 运行测试和提交**

Run: `cd frontend-visitor && node src/pages/ProfilePage.mobile.test.mjs && node src/responsive.test.mjs`

Expected: PASS。

Commit: `feat: 重设计移动个人数字档案`，使用 Lore trailers。

---

### Task 4: 统一响应式门禁与全量验证

**Files:**
- Modify: `frontend-visitor/src/responsive.test.mjs`
- Modify only if failing evidence requires: the three page TSX/CSS files and their tests.

**Interfaces:**
- Consumes: Tasks 1–3 的全部页面结构。
- Produces: 三个页面统一尺寸、短横屏和单滚动所有者的发布证据。

- [ ] **Step 1: 增加三页统一尺寸和滚动断言**

```js
for (const css of [historyCss, feedbackCss, profileCss]) {
  assert.match(css, /14px/, 'mobile personal pages use the 14px edge/spacing scale')
  assert.doesNotMatch(css, /overflow-y:\s*(?:auto|scroll)/, 'personal page components do not become nested scrollers')
}
assert.match(profileMobile, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
assert.doesNotMatch(profileMobile, /grid-template-columns:\s*1fr;[\s\S]*\.profile-stat/, 'mobile stats must not collapse to four large rows')
for (const viewport of [[375, 667], [390, 844], [430, 932], [844, 390], [932, 430]]) {
  assert.ok(viewport[0] >= 375)
}
```

测试同时验证三个 CSS 都存在完全一致的短横屏媒体条件，页面最后内容依赖全局 bottom padding 而非页面 fixed 高度。

- [ ] **Step 2: 运行全部 Node 测试**

Run: `cd frontend-visitor && for test_file in $(find src -name '*.test.mjs' -type f | sort); do node "$test_file" || exit 1; done`

Expected: 所有测试文件退出码 0。

- [ ] **Step 3: 运行 Lint、构建和差异检查**

Run: `cd frontend-visitor && npm run lint`

Expected: exit 0，无 warning。

Run: `cd frontend-visitor && npm run build`

Expected: TypeScript 与 Vite exit 0。

Run: `git diff --check && git status --short`

Expected: diff check 无输出；提交后工作区干净。

- [ ] **Step 4: 独立审查完整功能**

审查至少确认：

- 三个页面不再复用移动大卡片结构；
- 历史请求卸载、失败和重试不会写入陈旧状态；
- 反馈提交成功刷新、失败保留输入，记录展开键稳定；
- 个人统计在竖屏为 2×2，资料不使用禁用 input；
- 375×667 与两个短横屏没有横向溢出、内部滚动或底部遮挡；
- 桌面结构和接口没有回归。

Critical/Important 必须修复并重新审查；Minor 记录为非阻断风险。若有修复，使用一个修复提交并重跑覆盖测试；无修复不得创建空提交。
