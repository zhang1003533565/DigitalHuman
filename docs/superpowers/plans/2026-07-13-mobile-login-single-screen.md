# 移动端登录页单屏适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让游客登录和注册页在手机当前可视区域内以单屏方式展示，禁止页面纵向滑动，并在软键盘、横屏和低高度场景中保持表单可操作。

**Architecture:** `LoginPage` 通过根元素 ref 同步 `window.visualViewport` 的真实高度与顶部偏移到 CSS 变量，并在不支持时回退到 `window.innerHeight`。`LoginPage.css` 在 768px 以下使用固定单屏布局，按宽度、可视高度和 `:focus-within` 分级压缩装饰内容，不新增页面或卡片滚动容器。

**Tech Stack:** React 19、TypeScript、Visual Viewport API、CSS、Node `assert` 源码契约测试、ESLint、Vite。

## Global Constraints

- 移动端登录页必须固定在真实可视区域，禁止页面级纵向滚动和回弹。
- 不得在登录页祖先设置 `touch-action: none`；表单控件必须保持可点击与可输入。
- 登录与注册模式必须保留所有必要字段和操作，触控目标不得低于 44px。
- 普通移动状态保留背景、品牌、主标题和数字人主体；日期、时间、天气、品牌副标语和标题副图隐藏。
- 表单聚焦、视口高度不超过 680px、视口高度不超过 520px时必须逐级压缩装饰区。
- 不得新增页面级或卡片级纵向滚动容器。
- 不修改认证接口、验证逻辑、数字人问候、路由或登录后跳转。
- 桌面端现有布局保持不变。

---

### Task 1: 同步移动浏览器真实可视区域

**Files:**
- Create: `frontend-visitor/src/pages/LoginPage.test.mjs`
- Modify: `frontend-visitor/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `window.visualViewport.height`、`window.visualViewport.offsetTop`、`window.innerHeight`。
- Produces: 登录页根元素 CSS 变量 `--login-viewport-height` 与 `--login-viewport-offset-top`；`authScreenRef: RefObject<HTMLElement | null>`。

- [ ] **Step 1: 写失败的 VisualViewport 生命周期契约**

  创建 `LoginPage.test.mjs`，读取 `LoginPage.tsx` 并断言：

  ```js
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
  ```

- [ ] **Step 2: 运行测试确认失败**

  Run: `cd frontend-visitor && node src/pages/LoginPage.test.mjs`

  Expected: FAIL，`authScreenRef` 和 VisualViewport 同步逻辑尚不存在。

- [ ] **Step 3: 实现视口变量同步和监听清理**

  在 `LoginPage` 中新增根元素 ref：

  ```tsx
  const authScreenRef = useRef<HTMLElement | null>(null)
  ```

  新增只运行一次的 effect：

  ```tsx
  useEffect(() => {
    const viewport = window.visualViewport

    function syncViewport() {
      const viewportHeight = viewport?.height ?? window.innerHeight
      const viewportOffsetTop = viewport?.offsetTop ?? 0
      const screen = authScreenRef.current

      if (!screen) return

      screen.style.setProperty('--login-viewport-height', `${viewportHeight}px`)
      screen.style.setProperty('--login-viewport-offset-top', `${viewportOffsetTop}px`)
    }

    syncViewport()
    viewport?.addEventListener('resize', syncViewport)
    viewport?.addEventListener('scroll', syncViewport)
    window.addEventListener('resize', syncViewport)

    return () => {
      viewport?.removeEventListener('resize', syncViewport)
      viewport?.removeEventListener('scroll', syncViewport)
      window.removeEventListener('resize', syncViewport)
    }
  }, [])
  ```

  将 `ref={authScreenRef}` 添加到登录页根 `<main>`。

- [ ] **Step 4: 运行目标测试、Lint 和构建**

  Run: `cd frontend-visitor && node src/pages/LoginPage.test.mjs && npm run lint && npm run build`

  Expected: 输出 `login viewport contract passed`；ESLint、TypeScript 与 Vite 构建通过。

- [ ] **Step 5: 提交视口同步**

  ```bash
  git add frontend-visitor/src/pages/LoginPage.test.mjs frontend-visitor/src/pages/LoginPage.tsx
  git commit -m "feat: 让移动登录页跟随真实可视区域"
  ```

---

### Task 2: 实现禁滑单屏与键盘紧凑布局

**Files:**
- Modify: `frontend-visitor/src/responsive.test.mjs`
- Modify: `frontend-visitor/src/pages/LoginPage.css`

**Interfaces:**
- Consumes: Task 1 的 `--login-viewport-height`、`--login-viewport-offset-top` 和现有 `.auth-screen--tourism`、`.auth-stage`、`.auth-copy--tourism`、`.auth-card--tourism`、`.auth-form` DOM。
- Produces: 768px 以下固定单屏布局；`:focus-within` 键盘紧凑状态；`max-height: 680px` 与 `max-height: 520px` 两级矮屏布局。

- [ ] **Step 1: 写失败的移动单屏 CSS 契约**

  在 `responsive.test.mjs` 中截取登录页 768px 移动规则并断言：

  ```js
  const loginMobile = loginCss.slice(loginCss.lastIndexOf('@media (max-width: 768px)'))
  assert.match(loginMobile, /\.auth-screen--tourism\s*\{[^}]*position:\s*fixed;[^}]*top:\s*var\(--login-viewport-offset-top, 0px\);[^}]*height:\s*var\(--login-viewport-height, 100dvh\);[^}]*overflow:\s*hidden;[^}]*overscroll-behavior:\s*none;/s)
  assert.doesNotMatch(loginMobile, /\.auth-screen(?:--tourism)?\s*\{[^}]*overflow-y:\s*auto/s)
  assert.doesNotMatch(loginMobile, /touch-action:\s*none/)
  assert.match(loginMobile, /\.auth-header-meta,[\s\S]*\.auth-brand-tagline,[\s\S]*\.auth-subtitle-image\s*\{[^}]*display:\s*none;/s)
  assert.match(loginMobile, /\.auth-input,[\s\S]*\.auth-form button,[\s\S]*\.auth-input__suffix--clickable\s*\{[^}]*min-height:\s*44px;[^}]*touch-action:\s*manipulation;/s)
  assert.match(loginMobile, /\.auth-stage:focus-within[\s\S]*\.login-dh-bubble[\s\S]*display:\s*none/s)
  assert.match(loginCss, /@media \(max-width: 768px\) and \(max-height: 680px\)/)
  assert.match(loginCss, /@media \(max-width: 768px\) and \(max-height: 520px\)/)
  ```

- [ ] **Step 2: 运行响应式测试确认失败**

  Run: `cd frontend-visitor && node src/responsive.test.mjs`

  Expected: FAIL，现有移动端仍声明 `.auth-screen { overflow-y: auto; }`，且没有固定视口和矮屏紧凑规则。

- [ ] **Step 3: 重写 768px 移动端单屏布局**

  删除现有移动规则中的 `.auth-screen { overflow-y: auto; }`，并在 768px 媒体查询中实现以下约束：

  ```css
  .auth-screen--tourism {
    position: fixed;
    top: var(--login-viewport-offset-top, 0px);
    left: 0;
    width: 100%;
    height: var(--login-viewport-height, 100dvh);
    padding: 8px;
    overflow: hidden;
    overscroll-behavior: none;
  }

  .auth-frame {
    height: 100%;
    min-height: 0;
  }

  .auth-header-meta,
  .auth-brand-tagline,
  .auth-subtitle-image,
  .auth-bottom-line {
    display: none;
  }

  .auth-stage {
    min-height: 0;
    grid-template-columns: 1fr;
    grid-template-rows: minmax(120px, 1fr) auto;
    gap: 8px;
    padding: 4px 8px 8px;
    overflow: hidden;
  }

  .auth-copy--tourism {
    min-height: 0;
    align-self: stretch;
    padding: 0;
  }

  .auth-card--tourism,
  .auth-card--login-compact {
    width: min(100%, 420px);
    min-height: 0;
    justify-self: center;
    padding: 18px 14px 14px;
  }

  .auth-card-top { margin-bottom: 12px; }
  .auth-form { gap: 8px; }
  .auth-form input { min-height: 44px; padding: 11px 48px; }
  .auth-actions--inline { gap: 8px; margin-top: 4px; }
  .auth-submit-button--inline { min-width: 112px; min-height: 44px; padding: 10px 18px; font-size: 18px; }

  .auth-input,
  .auth-form button,
  .auth-input__suffix--clickable {
    min-height: 44px;
    touch-action: manipulation;
  }
  ```

  同一媒体查询内把品牌标识缩至 44px、标题图限制在可用装饰区内，并让错误文案使用紧凑行高；不得为 `.auth-stage`、`.auth-card` 或 `.auth-form` 添加 `overflow-y: auto|scroll`。

- [ ] **Step 4: 实现聚焦与矮屏分级压缩**

  添加以下状态，不修改 DOM：

  ```css
  @media (max-width: 768px) {
    .auth-stage:focus-within {
      grid-template-rows: 0 minmax(0, 1fr);
      gap: 0;
    }

    .auth-stage:focus-within .auth-copy--tourism,
    .auth-stage:focus-within .login-dh-bubble,
    .auth-stage:focus-within .login-dh-outfit-btn {
      display: none;
    }

    .auth-stage:focus-within .auth-card--tourism {
      align-self: center;
    }
  }

  @media (max-width: 768px) and (max-height: 680px) {
    .auth-title-image,
    .login-dh-bubble,
    .login-dh-outfit-btn { display: none; }
    .auth-stage { grid-template-rows: minmax(72px, 0.35fr) auto; }
  }

  @media (max-width: 768px) and (max-height: 520px) {
    .auth-copy--tourism,
    .login-dh-embed { display: none; }
    .auth-stage { grid-template-rows: minmax(0, 1fr); }
    .auth-card--tourism { align-self: center; }
  }
  ```

  注册模式必须沿用同一紧凑卡片；通过 44px 输入框、8px 表单间距和紧凑标题/操作区容纳四个字段，不得删除字段。

- [ ] **Step 5: 运行目标测试确认通过**

  Run: `cd frontend-visitor && node src/pages/LoginPage.test.mjs && node src/responsive.test.mjs`

  Expected: 输出 `login viewport contract passed` 和 `responsive contract passed for 12 routed page styles`。

- [ ] **Step 6: 执行游客端完整验证**

  Run:

  ```bash
  cd frontend-visitor
  for test_file in $(find src -name '*.test.mjs' -print | sort); do node "$test_file" || exit 1; done
  npm run lint
  npm run build
  git diff --check
  ```

  Expected: 全部 Node 测试、ESLint、TypeScript、Vite 构建和 diff 检查通过。

- [ ] **Step 7: 提交单屏布局**

  ```bash
  git add frontend-visitor/src/responsive.test.mjs frontend-visitor/src/pages/LoginPage.css
  git commit -m "fix: 让移动登录页保持禁滑单屏"
  ```

## 完成标准

- 移动登录页不再声明或产生纵向页面滚动。
- 页面高度和顶部跟随 VisualViewport，软键盘打开与关闭后重新同步。
- 390×844 等常见手机尺寸保留品牌、标题、数字人和完整登录卡片。
- 注册模式保留四个字段与两个操作，且无需页面滑动。
- 聚焦、横屏和矮屏状态逐级隐藏装饰但不隐藏必要认证操作。
- 桌面端样式未被移动端规则影响。
- 游客端全部自动化验证通过。
