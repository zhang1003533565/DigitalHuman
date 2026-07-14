# 管理后台数字孪生驾驶舱重写实施计划

## 目标

以 `docs/design/admin-digital-twin/` 下 19 张设计图为唯一视觉基线，重写 `frontend-admin` 的登录页、公共后台框架和全部业务页。保留现有 API、权限、表格编辑和模型配置能力；设计图中存在但当前代码缺失的查询、筛选、状态概览与空状态交互在前端补齐。

## 验收标准

- 桌面端 1440×1024 下，侧栏 208px、顶部运行状态栏 56px、内容密度和深色令牌与设计规范一致。
- 19 个路由共用同一套侧栏、顶部栏、页面标题区、卡片、表格、表单和状态色。
- 运营总览以地图为主画布；直播、知识库、配置页保持设计图规定的主次结构。
- 原有接口调用、增删改查、登录权限、直播发布、模型测试等功能不回退。
- 问答记录由占位说明升级为可搜索、可筛选、可查看详情的记录工作台。
- 1024px 与 768px 断点可用；移动端后台允许纵向滚动，不出现横向页面溢出。
- Node 结构测试、ESLint、TypeScript/Vite production build 全部通过。
- 浏览器完成 dashboard、列表页、直播页、知识库页、设置页视觉对照；根目录 `design-qa.md` 最终结果为 `passed`。

## 任务 1：锁定公共设计契约（测试先行）

**文件：**

- 新建：`frontend-admin/src/pages/admin-cockpit.test.mjs`
- 新建：`frontend-admin/src/adminPageMeta.ts`
- 新建：`frontend-admin/src/components/AdminTopbar.tsx`
- 新建：`frontend-admin/src/components/AdminPageFrame.tsx`
- 新建：`frontend-admin/src/admin-cockpit.css`
- 修改：`frontend-admin/src/main.tsx`
- 修改：`frontend-admin/src/pages/AdminLayout.tsx`
- 修改：`frontend-admin/src/components/AdminSidebar.tsx`

**步骤：**

1. 添加失败测试，约束 19 个页面元数据、统一顶部栏、页面框架、导航顺序、移动端断点和深色令牌。
2. 运行测试确认失败。
3. 实现数据驱动页面元数据、顶部状态栏、页面标题框架和固定侧栏。
4. 引入独立驾驶舱样式，统一 Ant Design 组件的深色外观与滚动行为。
5. 运行结构测试、Lint 和 Build。

## 任务 2：重写登录页与运营总览

**文件：**

- 修改：`frontend-admin/src/App.tsx`
- 修改：`frontend-admin/src/pages/OperationsDashboardPage.tsx`
- 修改：`frontend-admin/src/admin-cockpit.css`
- 修改：`frontend-admin/src/pages/admin-cockpit.test.mjs`

**步骤：**

1. 先补充登录页单屏、总览地图主画布与分区结构测试。
2. 登录页改为数字孪生预览 + 紧凑登录工作区，保留真实登录逻辑。
3. 总览重排为指标列、地图主画布、告警/服务状态、趋势与排行；接口异常时保留可重试能力。
4. ECharts 统一暗色轴线、提示框、青蓝趋势色。
5. 验证测试、Lint、Build。

## 任务 3：统一景区内容管理页面

**文件：**

- 修改：`frontend-admin/src/pages/AdminLayout.tsx`
- 修改：`frontend-admin/src/pages/HomeConfigPage.tsx`
- 修改：`frontend-admin/src/pages/scenic/*.tsx`
- 修改：`frontend-admin/src/pages/travel-tips/TravelTipManagementPage.tsx`
- 修改：`frontend-admin/src/admin-cockpit.css`

**步骤：**

1. 用公共页面框架统一首页配置、景点、分类、设施、路线、分析、结构化数据、口播和贴士页面。
2. 把筛选、批量操作、主操作按钮归并到标题区/工具条。
3. 表格页采用稳定列宽、暗色状态标签、固定分页与可滚动内容区。
4. 配置页采用对象选择 + 编辑/预览双栏结构，保存动作保持可见。
5. 验证现有 CRUD 与表单逻辑未回退。

## 任务 4：统一数字人、反馈、直播与问答页面

**文件：**

- 修改：`frontend-admin/src/pages/AdminLayout.tsx`
- 修改：`frontend-admin/src/pages/ModelEmotionPage.tsx`
- 修改：`frontend-admin/src/pages/FeedbackManagementPage.tsx`
- 修改：`frontend-admin/src/pages/LiveBroadcastManagementPage.tsx`
- 新建：`frontend-admin/src/pages/QaRecordsPage.tsx`
- 新建：`frontend-admin/src/api/qaRecords.ts`（存在可用后端接口时接入，否则使用会话接口适配）
- 修改：`frontend-admin/src/admin-cockpit.css`

**步骤：**

1. 数字人配置页改成配置区 + 实时预览区，保留模型、音色、动作和测试能力。
2. 反馈页改成结论优先的指标、趋势、问题分类和明细工作台。
3. 直播页按发布状态、脚本队列、直播预览和版本记录重排，保留服务器草稿恢复逻辑。
4. 问答页实现关键词、时间、状态筛选和详情抽屉，替换当前占位说明。
5. 完成权限与错误态验证。

## 任务 5：统一 AI 模型、知识库与系统设置

**文件：**

- 修改：`frontend-admin/src/pages/AiModelManagementPage.tsx`
- 修改：`frontend-admin/src/pages/KnowledgeOpenApiPage.tsx`
- 修改：`frontend-admin/src/pages/AdminLayout.tsx`
- 修改：`frontend-admin/src/pages/settings/*.tsx`
- 修改：`frontend-admin/src/admin-cockpit.css`

**步骤：**

1. AI 模型页采用模型目录、绑定状态、测试结果的高密度双栏工作区。
2. 知识库页保持目录树、文档列表、内容/分段三栏；统一同步状态和底部连接状态。
3. 系统设置统一能力标签、模型列表与当前配置双栏结构。
4. 保留连接测试、模型测试、智能体编排和保存逻辑。
5. 验证所有设置页面可达且错误/加载态清晰。

## 任务 6：全量验证与视觉验收

**文件：**

- 新建：`design-qa.md`
- 可能修改：上述样式与页面文件

**步骤：**

1. 运行全部 `*.test.mjs`、ESLint、TypeScript/Vite build。
2. 启动 `frontend-admin`，在 1440×1024 捕获登录、总览、景点、直播、知识库、设置页面。
3. 将实现截图与对应设计图并排检查布局、层级、间距、颜色、溢出和交互状态。
4. 修复所有 P0/P1/P2 视觉问题并复验。
5. 在 `design-qa.md` 记录对照页面、差异处理、验证证据与 `final result: passed`。

## 风险与处理

- **页面数量多：** 公共框架和令牌先行，通过页面元数据与全局组件覆盖 19 页，减少重复改动。
- **旧 CSS 体量大：** 新样式独立为 `admin-cockpit.css`，仅在 `.admin-shell` / `.login-page` 范围内提高确定性，避免影响游客端。
- **接口数据与设计样例不同：** 页面展示真实接口数据；没有数据时呈现业务化空状态，不伪造持久化结果。
- **问答接口不完整：** 优先复用现有会话消息接口；若后端没有管理查询接口，则实现前端适配层与明确的空状态，避免静态假记录。
