# Qwen / 阿里云百炼 模型说明

本文只按阿里云百炼（Model Studio）官方文档中**明确公开可确认**的内容整理，不写推荐推断。

更新时间基准：
- 当前整理时间：2026-05-23

官方来源：
- 模型大全：https://help.aliyun.com/zh/model-studio/models
- 模型总览页：https://help.aliyun.com/zh/model-studio/model
- OpenAI 兼容说明：https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope

## 官方明确列出的模型

根据百炼官方“模型大全 / 模型总览”页面，当前可明确确认的公开模型类别包括：

### 文本生成

千问模型示例：

- `qwen3.7-max`
- `qwen3.6-plus`
- `qwen3.6-flash`

第三方模型示例：

- `deepseek-v4-pro`
- `deepseek-v4-flash`
- `kimi-k2.6`
- `glm-5.1`
- `MiniMax-M2.7`
- `mimo-v2.5-pro`

### 图像与视频理解 / 生成

官方页面列出的示例包括：

- `qwen3.6-plus`
- `qwen3.5-omni-plus`
- `kimi-k2.6`
- `wan2.7-image-pro`
- `qwen-image-2.0-pro`

### 音频与语音

官方页面列出的示例包括：

- `cosyvoice-v3.5-plus`
- `MiniMax/speech-2.8-hd`
- `fun-asr-realtime`
- `fun-asr`
- `qwen3.5-omni-plus-realtime`
- `qwen3.5-omni-plus`

### 全模态

官方页面明确列出：

- `qwen3.5-omni-plus-realtime`
- `qwen3.5-omni-plus`

### 向量与重排序

官方页面明确列出：

- `text-embedding-v4`
- `tongyi-embedding-vision-plus`
- `qwen3-rerank`

### 接入方式

如果使用百炼 OpenAI 兼容模式，官方文档给出的兼容入口是：

- 中国大陆：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- 国际站：`https://dashscope-intl.aliyuncs.com/compatible-mode/v1`

## 官方未明确公开的模型类型

百炼官方页面已经给出了比较丰富的模型分类与示例，但并不是每个分类都在单页里完整列出所有可用模型字符串。

因此：

- 本页只记录官方页面明确列出的示例模型
- 不把“可能存在但当前页面未完整展开”的型号补写进来

如果你后续要在系统里挂载 Qwen 模型，最好再以百炼当前模型广场或接口返回值做最终确认。
