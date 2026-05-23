# 本地 TTS / 音色说明

当前项目的语音合成不是远程大模型 provider，而是走本地 `edge-tts`。

## 官方明确列出的模型

这里更准确的叫法不是“模型”，而是：

- 本地可用音色（voice）

当前系统会动态读取：

- `edge_tts.list_voices()`

因此网页里看到的语音项，是当前本地环境真实支持的微软 voice 列表，例如：

- `zh-CN-XiaoxiaoNeural`
- `zh-CN-YunxiNeural`
- `en-US-JennyNeural`

## 官方未明确公开的模型类型

这里不是远程 LLM 模型清单，不适合和对话模型、视觉模型放在同一标准下理解。

它更适合理解为：

- 本地 TTS 音色能力
