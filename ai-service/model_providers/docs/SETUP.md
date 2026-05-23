# 模型手动配置与测试

当前后台已经改为手动维护模型，不再自动同步官方模型。

你需要手动填写两部分：

1. 管理后台里的模型候选项
2. `ai-service/model_providers/<provider>/config.local.json` 里的 provider 连接信息

## 1. 本地配置文件

复制示例文件：

```bash
cd ai-service
cp model_providers/config/model_provider_configs.example.json model_providers/deepseek/config.local.json
```

然后把内容改成对应 provider 的实际配置。不同 provider 建议各自放在自己的目录下，例如：

- `model_providers/deepseek/config.local.json`
- `model_providers/openai/config.local.json`
- `model_providers/qwen/config.local.json`

示例：

```json
{
  "providers": [
    {
      "provider": "DeepSeek",
      "protocol": "openai_compatible",
      "baseUrl": "https://api.deepseek.com",
      "apiKey": "sk-xxxxx"
    }
  ]
}
```

## 2. 后台里怎么填

在后台设置页的“手动维护”里逐条添加：

- 模型分类：`embedding` / `speech` / `vision` / `chat` / `multimodal`
- 模型提供方：必须和对应 `config.local.json` 的 `provider` 保持一致
- 模型 ID：填官方模型名

## 3. 当前测试规则

- `embedding`
  - `BAAI` / `Local`：直接测试本地 embedding 模型是否能返回向量
  - 已接入兼容协议的 provider：按 `/embeddings` 测试
- `vision`
  - 按兼容对话接口做连通性测试
  - 当前是文本探活，不会真的上传图片
- `chat`
  - 按兼容对话接口做连通性测试
- `multimodal`
  - 按兼容对话接口做连通性测试
- `speech`
  - 当前走本地 `edge-tts` 风格语音名测试

## 4. 注意

- 这里的“测试”优先验证“这个 provider + modelId + 凭证”能不能打通
- 它不是完整业务验证，不代表你所有上层场景都已经适配
- 如果以后新增 provider 专属能力文件，可以继续扩展测试逻辑
