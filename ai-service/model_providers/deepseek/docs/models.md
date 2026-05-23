# DeepSeek 模型说明

本文只按 DeepSeek 官方文档中**明确公开可确认**的内容整理，不写推荐推断，不补未公开清单。

更新时间基准：
- 当前整理时间：2026-05-23

官方来源：
- 官方 API 文档：https://api-docs.deepseek.com/
- 模型列表接口：https://api-docs.deepseek.com/api/list-models
- 价格与能力页：https://api-docs.deepseek.com/quick_start/pricing/
- Chat Completions：https://api-docs.deepseek.com/api/create-chat-completion
- 更新日志：https://api-docs.deepseek.com/updates/

## 官方明确列出的模型

根据官方 `GET https://api.deepseek.com/models` 文档示例，当前明确列出的模型是：

- `deepseek-v4-flash`
- `deepseek-v4-pro`

根据官方 “Models & Pricing” 页，这两款模型明确具备：

- 支持 Thinking Mode
- 支持 JSON Output
- 支持 Tool Calls
- 支持 Chat Prefix Completion（Beta）
- 支持 FIM Completion（Beta，限 non-thinking 模式）
- 上下文长度：`1M`
- 最大输出：`384K`

当前文档能明确确认的接入方式：

- Base URL：`https://api.deepseek.com`
- 鉴权：`Authorization: Bearer <TOKEN>`
- 对话接口：`POST /chat/completions`

## 官方未明确公开的模型类型

截至 2026-05-23，按公开官方文档，我**没有看到** DeepSeek 给出完整的多类型模型公开清单。以下类型在当前公开文档里**未见完整、明确、可直接引用的模型列表**：

- 向量模型 / Embedding 模型
- 独立视觉模型
- 独立语音模型
- 独立重排序模型

因此在当前系统里，DeepSeek 文档只能严谨地写成：

- 已明确公开：`deepseek-v4-flash`、`deepseek-v4-pro`
- 未明确公开：Embedding 等其它模型类型的完整官方清单
