# 全系统升级验证记录（2026-07-12 执行）

## 结论

本轮代码构建、两个前端全量 Lint、前端契约测试、Java 全量测试、AI 单测/编译和敏感信息扫描均通过。五宽视觉检查和三条端到端流程因浏览器及服务未启动未执行；不得据此宣称视觉与真实端到端验收完成。

## 自动验证

| 范围 | 命令 | 结果 |
| --- | --- | --- |
| 游客端契约 | `node src/api/contracts.test.mjs`、`node src/pages/HomePage.test.mjs`、`node src/responsive.test.mjs`、`node src/api/client.test.mjs`、`node src/pages/mapConfig.test.mjs`、`node src/digitalHuman/streamingSpeech.test.mjs` | 通过 |
| 游客端构建 | `npm run build` | 通过 |
| 游客端 Lint | `npm run lint` | 通过：0 errors、0 warnings |
| 管理端契约 | `node src/pages/admin-upgrade.test.mjs` | 通过 |
| 管理端构建 | `npm run build` | 通过；存在 bundle 大于 500 kB 的非阻塞警告 |
| 管理端 Lint | `npm run lint` | 通过：0 errors、0 warnings |
| Java | `./mvnw test` | 通过：38 tests，0 failures，0 errors；原 socket 测试夹具已改为 Mockito `OkHttpClient`/`Call` 内存响应 |
| AI | `./.venv/bin/python -m unittest discover -s tests -v` | 通过：8 tests |
| AI 编译 | `PYTHONPYCACHEPREFIX=/tmp/digitalhuman-pycache ./.venv/bin/python -m compileall -q -x '/\.venv/' .` | 通过 |
| 敏感信息/伪操作 | brief 中 `rg` 命令（额外排除本地 `.venv`） | 通过：无匹配 |

## 本轮收口修补

- 地图桌面侧栏移除了错误的动态 `aria-hidden`，并加入静态回归断言。
- 模型提供方连接测试、单模型测试均用 `try/catch/finally` 保证 loading 状态复位。
- 运营总览改为父组件仅创建一份 overview 请求状态，三个区域继续各自渲染 loading/error/data 分区。
- AI 流式响应在 HTTP 状态检查失败时也显式关闭，并加入回归单测。
- 管理端景点地图移除仓库内高德明文 Key，统一读取 `VITE_AMAP_KEY` 与 `VITE_AMAP_SECURITY_KEY`；同时清理会触发 secret 扫描的示例字符串。

## 响应式宽度

未进行真实浏览器视觉验收。游客端静态验证来自 `frontend-visitor/src/responsive.test.mjs`，覆盖全局 `44px` 触控 token、safe-area、移动底栏及 11 个游客端路由页的 `768px` 断点；管理端 `768px`/`1024px` 断点与导航结构验证来自 `frontend-admin/src/pages/admin-upgrade.test.mjs`。两个前端在默认桌面样式下构建通过。

| 宽度 | 登录/首页/数字人/路线/地图/历史/反馈/管理页 | 证据状态 |
| --- | --- | --- |
| 360px | 未人工检查横向滚动、遮挡、重叠、弹层与实际触控尺寸 | 仅静态 CSS/契约证据 |
| 390px | 同上 | 仅静态 CSS/契约证据 |
| 768px | 同上 | 断点契约通过，未视觉检查 |
| 1024px | 同上 | 管理端断点存在，未视觉检查 |
| 1440px | 同上 | 默认桌面构建通过，未视觉检查 |

## 端到端流程

本地 `127.0.0.1:5173`、`:8080`、`:18755` 均无法连接，因此三条流程均未运行：

1. 亲子 4 小时路线 → 地图绘制 → 数字人续讲：未运行；首页、API 合同、导航上下文和流式语音测试提供局部证据。
2. “灵山大佛怎么走” → 来源/追问 → 反馈 → 后台状态：未运行；前后端合同及 Java 非 socket 用例提供局部证据。
3. 停止 AI → 官方路线/问答降级/后台 degraded：未运行；AI provider 超时降级单测和后台健康状态结构断言提供局部证据。

## 剩余风险与复验条件

- 启动游客端、管理端、Java、AI（及所需数据服务），用浏览器完成五宽十类页面和三条 E2E；记录截图、横向滚动、遮挡、文本重叠、弹层关闭和核心触控目标结果。
- 管理端如使用地图选点，部署环境必须同时配置 `VITE_AMAP_KEY` 与 `VITE_AMAP_SECURITY_KEY`。

管理端没有使用文件级 `react-hooks/set-state-in-effect` 豁免。远程请求初始化、Ant Design Form 与受控选择同步、受控分页重置等确需在 effect 中更新状态的点，使用了紧邻具体语句且写明原因的 `eslint-disable-next-line`；其余类型和依赖问题直接修复。
