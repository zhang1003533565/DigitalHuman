# MaxKB 源码一致的文档上传设计

## 目标

将 DigitalHuman 管理端的知识库文档上传流程改造成与 MaxKB 源码一致的两步式体验，并由 MaxKB OpenAPI 提供真实模型列表。用户不再手工填写模型 UUID，而是从当前 MaxKB 工作空间的模型下拉框中选择。

本设计只覆盖 MaxKB OpenAPI 已支持的普通文档上传。QA 文档和表格文档依赖 MaxKB 内部专用接口，不在本次界面中伪装成可用能力。

## 源码依据

上传交互以以下 MaxKB 源码为准：

- `ui/src/views/document/UploadDocument.vue`：两步流程、底部操作区和最终导入。
- `ui/src/views/document/upload/UploadComponent.vue`：拖拽区、文件格式提示、文件卡片和删除操作。
- `ui/src/views/document/upload/SetRules.vue`：四种分段策略、模型选择、任务进度和分段预览。
- `ui/src/api/model/model.ts`：工作空间模型下拉列表的来源和模型类型参数。
- `apps/knowledge/open_api/views.py`：异步上传、任务预览和确认入库契约。

## 总体流程

DigitalHuman 的知识库详情页继续保留“上传文档”入口。点击后进入覆盖当前内容区的上传工作台，而不是在窄抽屉中堆叠上传表单、任务表和预览表。

上传工作台包含三个状态：

1. 选择文件。
2. 设置分段规则并预览。
3. 确认入库成功。

第一步底部显示“取消”和“下一步”。第二步底部显示“取消”“上一步”和“导入”。只有异步任务完成且预览数据可用时，“导入”按钮才能点击。

## 第一步：选择文件

页面显示标题“上传文档”和一个大面积拖拽上传区，支持多文件选择。格式提示与 MaxKB 普通文档上传保持一致：TXT、Markdown、PDF、DOCX、HTML、XLS、XLSX、CSV、ZIP。

客户端执行以下基础校验：

- 最多 50 个文件。
- 单文件小于 100 MB。
- 空文件不可上传。
- 扩展名必须在支持列表中。

已选择文件以两列文件卡片展示，包含文件图标、名称、大小和删除按钮。返回上一步时保留文件列表，关闭上传工作台时清空本次草稿。

## 第二步：分段设置和预览

主体采用 MaxKB 的左右分栏结构。

左侧宽度约 42%，包含四张单选策略卡：

1. 智能分段：使用 MaxKB 默认规则，不传 `split_strategy`、`patterns` 和自定义 `limit`。
2. 高级分段：不传 `split_strategy`，允许设置多个分段标识、分段长度和文本清洗。
3. 模型分段：传 `split_strategy=llm_text` 和所选 `model_id`，可开启高质量优化。
4. 视觉模型分段：传 `split_strategy=llm_vision`、`vision_model_id` 和 `llm_model_id`，可开启高质量优化。

高级分段中的分段标识使用可创建标签的多选框；分段长度使用 50 到 100000 的滑块和数值输入；文本清洗、高质量优化使用开关。

模型分段的模型选择器按提供商分组。LLM 模型仅显示 `model_type=LLM`，视觉理解模型仅显示 `model_type=IMAGE`。选项值必须是 MaxKB 模型 UUID，显示文本优先使用模型名称，并补充提供商和模型标识。

左侧底部显示“预览”按钮。模型策略未选择必需模型时按钮禁用。

右侧宽度约 58%，显示当前上传任务的阶段、百分比、文件或处理数量，以及分段预览。处理中允许取消任务；失败时保留错误信息并允许重新预览；成功后展示文档及段落内容。

## MaxKB OpenAPI 扩展

新增接口：

```text
GET /openapi/knowledge/v1/workspaces/{workspace_id}/models?model_type=LLM
GET /openapi/knowledge/v1/workspaces/{workspace_id}/models?model_type=IMAGE
```

接口继续使用 `Authorization: Bearer <api_key>`。处理流程为：

1. 调用 `authenticate_open_api_key` 验证 API Key。
2. 调用 `check_workspace` 验证工作空间范围。
3. 校验 `model_type` 只能为 `LLM` 或 `IMAGE`。
4. 返回当前工作空间可用模型及共享模型的最小展示信息。

响应数据中的每个模型只包含：

```json
{
  "id": "模型 UUID",
  "name": "显示名称",
  "model_name": "模型标识",
  "model_type": "LLM",
  "provider": "提供商",
  "scope": "workspace"
}
```

`scope` 可为 `workspace` 或 `shared`。接口不返回 API Key、凭证、模型参数或其他敏感配置。

OpenAPI 文档页面和 schema 同步补充该接口。

## DigitalHuman 后端代理

DigitalHuman 新增管理端接口：

```text
GET /api/admin/knowledge/maxkb/accounts/{accountId}/models?model_type=LLM
```

后端根据账户连接配置拼接 MaxKB OpenAPI 地址，并使用账户保存的 API Key 请求模型列表。响应沿用现有 MaxKB JSON 解析和非 JSON 错误诊断机制。

模型列表不落库、不混入 DigitalHuman 的模型管理配置，也不暴露 MaxKB API Key 给浏览器。

## 异步任务状态流

点击“预览”时，以 `auto_apply=false` 创建上传任务。前端保存当前任务 ID 并轮询任务详情：

- `uploading`：浏览器正在上传文件。
- `queued`：MaxKB 已接收任务，等待执行。
- `processing` 或 `parsing`：解析和分段中。
- 可预览状态：加载 `/preview` 并展示结果。
- `failed`：停止轮询，显示上游错误。
- `cancelled`：停止轮询，允许重新预览。

点击“导入”调用任务 `/apply` 接口。成功后刷新知识库文档列表并进入成功状态。

历史任务不再占据上传主界面，收纳到第二步右侧的折叠区域，供异常恢复、取消和删除使用。

## 错误处理

- 模型列表加载失败：模型策略卡仍可见，但模型选择器显示失败状态和重试按钮；智能分段和高级分段仍可用。
- MaxKB 返回 HTML：展示现有明确诊断，提示服务尚未部署对应 OpenAPI 路由或代理转发错误。
- 上传校验失败：在文件卡片附近显示具体文件和原因。
- 任务失败：保留文件与分段设置，允许用户直接重新创建预览任务。
- 页面关闭或知识库切换：停止轮询，避免旧任务更新新页面状态。

## 响应式布局

桌面端保持 MaxKB 的左右分栏。窄屏下改为纵向排列，分段设置在上、预览在下；底部操作栏固定在上传工作台底部。所有按钮、进度和模型名称不得挤压或覆盖相邻内容。

## 测试与验收

MaxKB：

- API Key 可列出所在工作空间的 LLM 和 IMAGE 模型。
- 非法 `model_type` 返回参数错误。
- 跨工作空间请求被拒绝。
- 响应不包含模型凭证和参数。

DigitalHuman 后端：

- 账户地址为复制的完整 OpenAPI 工作空间 URL 时，模型列表路径不会重复拼接。
- `model_type` 正确转发。
- MaxKB HTML 响应转换为清晰的 502 提示。

DigitalHuman 前端：

- 上传入口进入两步工作台。
- 文件类型、大小、数量和空文件校验有效。
- 四种分段策略生成正确请求参数。
- 模型选项来自 MaxKB 接口且按提供商分组。
- 模型未选择时不能启动模型分段预览。
- 预览、取消、重试和确认入库状态正确。
- 桌面和移动视口没有重叠或溢出。

## 非目标

- 不实现 QA 文档和表格文档的 MaxKB 内部上传接口。
- 不复制 MaxKB 的模型凭证到 DigitalHuman。
- 不修改知识库检索、文档浏览和段落编辑行为。
- 不引入新的前端依赖。
