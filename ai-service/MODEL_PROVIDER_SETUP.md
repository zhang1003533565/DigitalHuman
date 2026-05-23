# 模型手动配置与测试

当前后台已经改为手动维护模型，不再自动同步官方模型。

你需要手动填写两部分：

1. 管理后台里的模型候选项
2. `ai-service/model_provider_configs.local.json` 里的 provider 连接信息

## 1. 本地配置文件

复制示例文件：

```bash
cd ai-service
cp model_provider_configs.example.json model_provider_configs.local.json
```

然后手动填写你实际要测试的 provider。

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

- 模型分类：`embedding` / `speech` / `vision` / `multimodal`
- 模型提供方：必须和 `model_provider_configs.local.json` 的 `provider` 保持一致
- 模型 ID：填官方模型名

## 3. 当前测试规则

- `embedding`
  - `BAAI` / `Local`：直接测试本地 embedding 模型是否能返回向量
  - 其它 provider：按 OpenAI-compatible `/embeddings` 测试
- `vision`
  - 按 OpenAI-compatible `/chat/completions` 做连通性测试
  - 当前是文本探活，不会真的上传图片
- `multimodal`
  - 按 OpenAI-compatible `/chat/completions` 做连通性测试
- `speech`
  - 当前只支持 `Azure` / `edge-tts` 风格语音名测试

## 4. 官方文档来源

### DeepSeek

- 模型列表：`GET https://api.deepseek.com/models`
- 对话接口：`POST /chat/completions`
- 认证方式：`Authorization: Bearer <TOKEN>`

来源：

- https://api-docs.deepseek.com/api/list-models
- https://api-docs.deepseek.com/api/create-chat-completion

### OpenAI

- 模型列表：`GET https://api.openai.com/v1/models`
- 对话接口：`POST https://api.openai.com/v1/chat/completions`
- Embedding 接口：`POST https://api.openai.com/v1/embeddings`

来源：

- https://platform.openai.com/docs/api-reference/models/list
- https://platform.openai.com/docs/api-reference/chat/create-chat-completion
- https://platform.openai.com/docs/api-reference/embeddings

## 5. 注意

- 这里的“测试”优先验证“这个 provider + modelId + 凭证”能不能打通
- 它不是完整业务验证，不代表你所有上层场景都已经适配
- 如果以后新增 `openai.py`、`qwen.py` 这类专属能力文件，可以继续扩展测试逻辑
