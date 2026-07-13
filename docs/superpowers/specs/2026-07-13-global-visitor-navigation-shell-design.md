# 游客端全局导航壳设计

## 目标

让 `/home` 与所有登录后游客页面使用完全相同的顶部导航 DOM 层级、宽度、滚动和用户菜单行为，不再依赖页面父容器的 padding、margin 或定位方式。

## 根因

当前虽然所有页面都引用 `VisitorTopNav`，但组件由各页面分别渲染：

- 首页位于无内边距的 `.page-shell.home-page`。
- 普通页面位于有内边距的 `.page-shell`。
- AI 导览位于绝对定位导航的 `.module-screen`。
- 直播页使用独立根容器。

因此相同组件仍受不同包含块、内边距和滚动容器影响。使用负 margin 抵消页面 padding 只能修补部分页面，不能保证行为一致。

## 已确认方案

`VisitorTopNav` 只在 `ProtectedRoute` 的全局认证壳中渲染一次，与 `MobileBottomNav` 同级。`Outlet` 放入独立内容容器；所有页面删除自己的 `VisitorTopNav` 导入和 JSX。

## 应用壳结构

```tsx
<div className="authenticated-app">
  <VisitorTopNav onLogout={onLogout} />
  <div className="authenticated-app__content">
    <Outlet />
  </div>
  <MobileBottomNav />
</div>
```

- 顶部导航不属于任何具体页面。
- 内容容器占据导航与移动底栏之间的剩余空间。
- 桌面端顶部导航正常参与纵向布局，不使用页面级绝对定位。
- 移动端顶部导航保持统一高度，内容区拥有主滚动；底部导航继续固定。

## 页面调整

- 删除所有游客页面中的 `VisitorTopNav` import 和 JSX。
- 首页保留自身内容背景和滚动，不再负责顶部导航。
- 普通 `.page-shell` 只负责正文 padding。
- `.module-screen` 不再为绝对导航预留或覆盖顶部空间。
- 直播页不再自行渲染导航。
- 删除上一轮 `.page-shell:not(.home-page) > .visitor-topbar` 负 margin 补丁。

## 行为

- 菜单项、当前路由高亮、头像菜单、退出登录逻辑保持不变。
- `VisitorTopNav` 继续通过 `useLocation()` 判断当前路由。
- 页面路由切换时导航组件不卸载，用户菜单状态只由组件自身交互控制。
- `/login` 不显示游客导航。

## 响应式与滚动

- `.authenticated-app` 使用纵向 flex/grid 壳。
- `.authenticated-app__content` 设置 `flex: 1 1 auto; min-height: 0; overflow: hidden`，页面内部按现有约定滚动。
- 移动端内容区为唯一主要纵向滚动边界时，页面根保持自然高度并预留底部导航安全区。
- 顶部导航始终与认证壳同宽，不由页面 padding 改变。

## 测试

- `App.tsx` 只渲染一次 `VisitorTopNav`，位置在 `Outlet` 之外。
- 所有游客页面不再导入或渲染 `VisitorTopNav`。
- 顶部导航组件菜单、激活态、键盘与头像菜单契约继续通过。
- CSS 契约验证全局内容容器尺寸和移动端滚动/安全区。
- 运行游客端全部 Node 测试、ESLint 和生产构建。

## 非目标

- 不改变菜单名称、顺序和目标路由。
- 不重新设计导航视觉。
- 不修改登录页、管理端导航或底部移动导航信息架构。
- 不打开浏览器；继续按用户要求使用代码、测试和构建验证。
