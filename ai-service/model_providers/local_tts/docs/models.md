# 本地 TTS / 音色说明

本文说明当前项目里“语音模型”这一栏在实际含义上对应什么。

更新时间基准：
- 当前整理时间：2026-05-23

## 官方明确列出的模型

当前项目的语音合成并不是接某一家远程大模型 provider，而是走本地 `edge-tts` 能力。

因此这里严格来说不是“模型列表”，而是：

- 本地可用音色（voice）列表

当前系统会通过下面的链路动态读取：

- `frontend-admin` -> `/api/tts/voices`
- `backend-java` -> `ai-service /voices`
- `ai-service` -> `edge_tts.list_voices()`

也就是说，网页里看到的语音项是**当前本地环境实际支持的 voice**，不是后台手工预置的模型。

## 官方未明确公开的模型类型

由于这里走的是本地 `edge-tts` 音色能力，而不是某家 provider 的统一“模型清单”，所以：

- 不适合把它写成远程 provider 模型文档
- 也不适合和 DeepSeek / OpenAI / Qwen 的对话模型放在同一层理解
