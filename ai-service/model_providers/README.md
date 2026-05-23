# 供应商连接目录

这个目录用于放“不同供应商”的接入与连接代码，不按能力类型分，而是按 provider 分。

建议职责：

- provider 的鉴权方式
- base URL / endpoint 规范
- provider 专属请求头
- provider 原生接口适配
- provider 返回值差异处理

和 `model_capabilities/` 的关系：

- `model_capabilities/`
  - 关注能力类型：`llm / tts / image / video`
- `model_providers/`
  - 关注供应商类型：`deepseek / openai / qwen / google / azure / local_tts`

后续如果要做“能力 x 供应商”的组合，可以让：

- `model_capabilities/llm/` 调用 `model_providers/deepseek/`
- `model_capabilities/image/` 调用 `model_providers/qwen/`
- `model_capabilities/tts/` 调用 `model_providers/local_tts/`

这样目录职责会更清楚。
