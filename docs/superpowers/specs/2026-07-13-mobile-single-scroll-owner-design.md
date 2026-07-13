# 移动端单一滚动所有者设计

## 问题与根因

认证游客页面在移动端已由 `.authenticated-app__content` 接管纵向滚动，但多个页面仍保留桌面端的内部纵向滚动容器，例如 `.page-content`、首页 `.hp-scroll` 和贴士 `.tips-scroll-area`。这些容器与外层滚动嵌套，部分还使用 `overscroll-behavior: contain`，会截获触摸手势并阻止滚动链传递，造成页面出现滚动条却无法稳定滑动。

## 目标

移动端认证游客页面只能有一个页面级纵向滚动所有者：`.authenticated-app__content`。页面主体使用自然高度参与外层滚动；只有内容本身必须独立浏览的交互区域可以保留局部滚动。

## 全局滚动契约

在宽度不超过 768px 时：

- `.authenticated-app__content` 保持 `overflow-y: auto`、`overflow-x: hidden` 和底部导航安全区。
- 直接路由页面根保持 `height: auto`、`min-height: 100%`、`overflow: visible`。
- `.page-content` 改为自然高度，不再使用 `flex: 1` 形成受限滚动盒；设置 `overflow: visible` 与 `overscroll-behavior: auto`。
- 页面主体不得声明 `overflow-y: auto|scroll`、`overflow: auto|scroll` 或 `overscroll-behavior: contain`。
- 页面主体允许 `touch-action: pan-y` 或默认 `auto`，不得用 `touch-action: none` 阻止页面手势。

桌面端继续保留现有页面内部滚动与固定高度布局，不受移动规则影响。

## 页面调整

### 首页

移动端 `.hp-scroll` 使用 `height: auto`、`min-height: 100%`、`overflow: visible`、`overscroll-behavior: auto`。首页全部推荐内容由外层认证内容容器滚动。

### 公共 page-shell 页面

反馈、历史、个人资料、景点推荐、路线推荐列表等使用 `.page-content` 的页面统一继承全局移动自然流规则，不再分别创建页面滚动盒。

### 游览贴士

移动端 `.tips-scroll-area` 改为 `flex: none`、`min-height: auto`、`overflow: visible`、`overscroll-behavior: auto`。顶部分类栏继续只允许横向滚动。

### 路线推荐

移动端继续保持路线详情、时间线和地图按自然流堆叠。桌面 `.route-planner`、`.route-timeline` 的滚动规则必须由移动覆盖为 `overflow: visible`，页面纵向滚动交给外层。

### 数字人

移动端 `.live2d-page` 和 `.digital-human-chat` 继续允许 `pan-y` 并进入自然流。数字人画布本身保留 `touch-action: none`，因为画布需要独占拖动交互；聊天消息历史和角色下拉菜单属于局部浏览区，可保留内部滚动。

### 地图与直播

地图主画布不改为页面滚动区。景点详情弹窗保留受限 `overflow-y: auto`，确保长详情可在固定浮层内浏览。

直播回答记录保留受限 `overflow-y: auto`；直播舞台画布继续独占自身触摸交互。直播页面主体仍由全局外层滚动。

## 局部滚动白名单

以下区域允许在移动端保留独立纵向滚动：

- `.digital-chat-body`
- `.digital-chat-select__menu`
- `.map-spot-card`
- `.live-interaction__answer`
- `.visitor-user-menu__dropdown`

新增局部滚动区域必须具有明确的 `max-height` 或受限高度，并在测试白名单中登记。页面根、页面主体、内容列表和普通卡片不得进入白名单。

## 底部导航与安全区

固定底部导航保持不变。`.authenticated-app__content` 继续统一预留 `mobile-nav-height + safe-bottom + 16px`，页面自身不得重复增加同等底部预留，避免双倍空白。

## 测试策略

- 响应式契约断言 `.authenticated-app__content` 是唯一页面级移动纵向滚动容器。
- 断言移动 `.page-content`、`.hp-scroll`、`.tips-scroll-area` 使用自然高度、`overflow: visible` 和 `overscroll-behavior: auto`。
- 扫描全部游客页面移动样式中的纵向滚动声明；只有局部滚动白名单选择器可使用 `overflow-y: auto|scroll`。
- 断言数字人画布、地图详情、直播回答和用户菜单的局部滚动/触摸能力未被误删。
- 运行游客端全部 Node 测试、ESLint、TypeScript 和 Vite 生产构建。

## 完成标准

- 首页、路线、贴士、反馈、历史、个人资料和推荐列表在移动端可通过同一个外层容器连续纵向滑动。
- 页面内部不再出现无法滚动或争抢手势的第二个页面级滚动盒。
- 地图弹窗、聊天消息、角色菜单、直播回答和用户菜单仍可独立滚动。
- 底部导航不遮挡最后一段内容，且不产生重复安全区。
- 桌面端布局与滚动行为无回归。
- 自动化验证全部通过。
