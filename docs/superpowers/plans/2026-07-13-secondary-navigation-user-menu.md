# 次级导航迁入用户菜单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将游览贴士、反馈记录和会话历史从顶部主导航迁入共享头像下拉框，使桌面端导航更简洁且移动端仍可访问全部功能。

**Architecture:** `VisitorTopNav` 保留四个核心主导航项，并新增一个固定的次级导航配置，由现有 portal 下拉框渲染。所有次级入口复用 `useNavigate`、`useLocation` 和现有菜单关闭逻辑，当前路由通过激活类及 `aria-current` 表达，不新增移动端专用组件。

**Tech Stack:** React 19、TypeScript、React Router、CSS、Node `assert` 源码契约测试、ESLint、Vite。

## Global Constraints

- 顶部主导航只能保留：首页、AI 导览、路线推荐、景点地图。
- 下拉框顺序必须是：个人资料、游览贴士、反馈记录、会话历史、分隔线、退出登录。
- 桌面端和移动端必须共用同一个头像下拉框，不新增第二套移动菜单。
- 次级导航项点击后必须关闭下拉框并导航。
- 当前次级页面必须显示激活样式并设置 `aria-current="page"`。
- 下拉菜单项触控高度不得小于 44px。
- 不修改页面路由、页面内容、移动端底部导航或认证逻辑。

---

### Task 1: 将次级导航迁入共享用户菜单

**Files:**
- Modify: `frontend-visitor/src/components/VisitorTopNav.test.mjs`
- Modify: `frontend-visitor/src/components/VisitorTopNav.tsx`
- Modify: `frontend-visitor/src/components/VisitorTopNav.css`

**Interfaces:**
- Consumes: `VisitorTopNav({ onLogout }: { onLogout: () => void })`、React Router `navigate(path)`、`location.pathname`、现有 `setDropdownOpen(false)` 菜单关闭状态。
- Produces: `VISITOR_NAV_ITEMS` 四个主入口；`USER_NAV_ITEMS` 三个 `{ to: string; label: string; icon: ReactNode }` 次级入口；`.visitor-user-menu__item--active` 激活样式。

- [ ] **Step 1: 写入失败的菜单信息架构契约**

  将 `VisitorTopNav.test.mjs` 的 `expectedItems` 改为仅包含四个主导航项，并增加对次级配置、顺序、跳转、关闭、激活语义和触控高度的断言：

  ```js
  const expectedItems = [
    ['/home', '首页'],
    ['/modules/digital-human', 'AI 导览'],
    ['/routes', '路线推荐'],
    ['/map', '景点地图'],
  ]

  const expectedUserItems = [
    ['/tips', '游览贴士'],
    ['/feedback', '反馈记录'],
    ['/history', '会话历史'],
  ]

  const userItemsBlock = source.match(/const USER_NAV_ITEMS = \[(.*?)\n\]/s)?.[1]
  assert.ok(userItemsBlock, 'USER_NAV_ITEMS must be a source-level fixed array')
  const actualUserItems = [...userItemsBlock.matchAll(/\{ to: '([^']+)', label: '([^']+)'/g)].map(
    ([, path, label]) => [path, label],
  )
  assert.deepEqual(actualUserItems, expectedUserItems)
  assert.match(source, /USER_NAV_ITEMS\.map/)
  assert.match(source, /setDropdownOpen\(false\)[\s\S]*navigate\(item\.to\)/)
  assert.match(source, /aria-current=\{item\.to === location\.pathname \? 'page' : undefined\}/)
  assert.match(source, /visitor-user-menu__item--active/)
  assert.match(css, /\.visitor-user-menu__item\s*\{[^}]*min-height:\s*44px;/s)
  ```

  补充源码顺序断言，确保个人资料在三个次级入口之前、退出登录在其后：

  ```js
  const profileIndex = source.indexOf('个人资料')
  const userNavigationIndex = source.indexOf('USER_NAV_ITEMS.map')
  const logoutIndex = source.indexOf('退出登录')
  assert.ok(profileIndex < userNavigationIndex && userNavigationIndex < logoutIndex)
  ```

- [ ] **Step 2: 运行目标测试并确认按预期失败**

  Run: `cd frontend-visitor && node src/components/VisitorTopNav.test.mjs`

  Expected: FAIL，主导航仍包含七项，且 `USER_NAV_ITEMS`、次级激活样式与 44px 最小高度尚不存在。

- [ ] **Step 3: 实现四项主导航和三个次级下拉入口**

  在 `VisitorTopNav.tsx` 中将 `VISITOR_NAV_ITEMS` 缩减为四项，并新增固定配置：

  ```tsx
  const USER_NAV_ITEMS = [
    { to: '/tips', label: '游览贴士' },
    { to: '/feedback', label: '反馈记录' },
    { to: '/history', label: '会话历史' },
  ]
  ```

  在个人资料按钮之后渲染三个入口。每项使用与产品语义对应的内联 SVG；核心交互必须保持以下结构：

  ```tsx
  {USER_NAV_ITEMS.map((item) => {
    const active = item.to === location.pathname
    return (
      <button
        key={item.to}
        className={`visitor-user-menu__item${active ? ' visitor-user-menu__item--active' : ''}`}
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => {
          setDropdownOpen(false)
          navigate(item.to)
        }}
      >
        {/* 对应菜单 SVG */}
        {item.label}
      </button>
    )
  })}
  ```

  将原本位于个人资料前的分隔线移动到三个次级入口之后、退出登录之前。个人资料继续持有 `profileActionRef`，保持菜单打开后的焦点行为。

- [ ] **Step 4: 实现激活状态和移动端触控尺寸**

  在 `VisitorTopNav.css` 中为所有下拉项设置触控高度，并添加激活态：

  ```css
  .visitor-user-menu__item {
    min-height: 44px;
  }

  .visitor-user-menu__item--active {
    color: #f1c76f;
    background: rgba(226, 173, 75, 0.12);
  }

  .visitor-user-menu__item--active:hover {
    color: #f7d58d;
    background: rgba(226, 173, 75, 0.18);
  }
  ```

  保持 `.visitor-user-menu__item--danger` 的退出登录颜色优先级，不让激活态影响危险操作。

- [ ] **Step 5: 运行目标测试并确认通过**

  Run: `cd frontend-visitor && node src/components/VisitorTopNav.test.mjs`

  Expected: 输出 `VisitorTopNav contract passed`，退出码为 0。

- [ ] **Step 6: 执行游客端完整验证**

  Run:

  ```bash
  cd frontend-visitor
  for test_file in $(find src -name '*.test.mjs' -print | sort); do node "$test_file" || exit 1; done
  npm run lint
  npm run build
  git diff --check
  ```

  Expected: 所有 Node 契约测试通过；ESLint 无错误；TypeScript 与 Vite 构建成功；`git diff --check` 无输出。

- [ ] **Step 7: 提交实现**

  ```bash
  git add frontend-visitor/src/components/VisitorTopNav.test.mjs frontend-visitor/src/components/VisitorTopNav.tsx frontend-visitor/src/components/VisitorTopNav.css
  git commit -m "feat: 让次级游客功能通过用户菜单访问"
  ```

## 完成标准

- 顶部只显示四个核心导航入口。
- 游览贴士、反馈记录、会话历史按指定顺序显示在头像下拉框中。
- 三个入口在桌面端和移动端均可点击并正确导航。
- 当前次级页面具有清晰的视觉与无障碍激活状态。
- 个人资料焦点、退出登录、Escape、外部点击和窗口变化关闭行为无回归。
- 游客端全部测试、ESLint 和生产构建通过。
