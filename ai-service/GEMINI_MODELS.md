# Gemini 模型说明

本文只按 Google Gemini 官方文档中**明确公开可确认**的内容整理，不写推荐推断。

更新时间基准：
- 当前整理时间：2026-05-23

官方来源：
- Gemini 模型页：https://ai.google.dev/models/gemini
- Gemini API 模型说明：https://ai.google.dev/gemini-api/docs/models/gemini
- 模型 API：https://ai.google.dev/api/models

## 官方明确列出的模型

根据 Google 官方 Gemini 模型页，当前明确公开展示的主力模型包括：

- `gemini-3-pro-preview`
- `gemini-2.5-flash`
- `gemini-2.5-pro`

官方页面明确展示的能力字段包括：

- Thinking
- Structured outputs
- Function calling
- Search grounding
- URL context
- Code execution
- File search
- Caching
- Batch API

此外，官方页面还说明了 Gemini 模型命名模式：

- Stable
- Preview
- Latest
- Experimental

例如：

- `gemini-2.5-flash`
- `gemini-2.5-flash-preview-09-2025`
- `gemini-flash-latest`

## 官方未明确公开的模型类型

截至当前公开页面，本页没有看到 Google 像 OpenAI Embeddings 那样，在同一体系里单独铺开“Embedding 模型列表”的完整公开清单。

因此本页不补写：

- 未在当前公开页明确列出的 embedding 型号
- 未在当前公开页明确列出的历史 Gemini 变体

也就是说：

- 当前本页只记录 Gemini 官方模型页明确能看到的模型名与命名模式
- 不对其它潜在型号做扩展推断

## 当前系统中的接入注意

Gemini 原生 API 不是本项目当前默认的 `openai_compatible` 测试协议。

所以即使这份文档里能列出 Gemini 官方公开模型，也不代表当前系统已经具备 Gemini 的原生测试适配。

如果后续要真正测试 Gemini，建议单独补一套 `gemini.py` provider 适配。
