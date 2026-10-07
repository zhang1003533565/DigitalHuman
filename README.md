# DigitalHuman

大境门景区数字人项目，当前由 4 个主要模块组成：

- `frontend-visitor`：游客端，React + Vite + TypeScript
- `frontend-admin`：管理后台，React + Vite + TypeScript
- `backend-java`：业务后端，Spring Boot
- `ai-service`：统一 AI 服务，FastAPI

当前 AI 层已经统一到一个 `FastAPI` 入口中，包含：

- RAG 文档上传与构建
- 向量检索与问答
- TTS 语音合成

## 目录结构

```text
DigitalHuman/
├─ frontend-visitor/
├─ frontend-admin/
├─ backend-java/
├─ ai-service/
│  ├─ docker-compose.yml
│  ├─ knowledge-base/
│  └─ storage/
├─ config/
│  └─ application-shared.properties
```

## 统一配置

统一服务地址和模块默认配置放在：

[config/application-shared.properties](/Users/zhangzesheng/Desktop/zzs/github/DigitalHuman/config/application-shared.properties:1)

关键配置：

```properties
app.backend-base-url=http://127.0.0.1:8080
app.ai-service-url=http://127.0.0.1:18755
app.ai-service-admin-token=${AI_SERVICE_ADMIN_TOKEN:}
app.qdrant-url=http://127.0.0.1:6333
```

说明：

- `backend-java` 会导入这份配置
- `ai-service` 会先读取这份配置，再读取 `ai-service/.env`
- `ai-service/.env` 只建议放本地覆盖项，例如模型密钥

Java 与 AI 服务间的 Provider 管理接口必须配置相同的 `AI_SERVICE_ADMIN_TOKEN`。Java 通过
`X-Service-Token` 转发；缺少令牌返回 401，令牌错误返回 403。Provider 查询只返回
`apiKeyMasked` 与 `configured`，绝不返回明文 API Key。

已有 MySQL 数据库升级反馈字段时，先执行
`backend-java/src/main/resources/db/migration/manual/2026-07-12-user-feedback-backfill.sql`。
脚本先回填历史空值，末尾包含可选的 `ALTER TABLE` 收紧语句；应用部署期间 JPA 字段保持 nullable，避免旧表启动失败。

## 环境要求

- Node.js 20+
- pnpm 9+ 或 npm 10+
- JDK 17
- Maven 3.9+
- Python 3.11
- Docker（如果你要跑 Qdrant 或 `docker compose`）

检查命令：

```bash
node -v
pnpm -v
npm -v
java -version
mvn -v
python3.11 --version
docker --version
```

## 首次安装

### 前端依赖

游客端：

```bash
cd frontend-visitor
pnpm install
cd ..
```

管理后台：

```bash
cd frontend-admin
npm install
# 如需在景点管理中使用地图选点，在本地环境配置：
# VITE_AMAP_KEY=...
# VITE_AMAP_SECURITY_KEY=...
cd ..
```

### Python 依赖

```bash
cd ai-service
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
cd ..
```

### Java 依赖

```bash
cd backend-java
./mvnw clean install
cd ..
```

如果你本机还没准备 MySQL，`backend-java` 的测试或启动可能会因为数据源问题失败，这属于环境未配齐，不是这次知识库功能的代码问题。

## 推荐启动方式

推荐按下面顺序启动：

1. Qdrant
2. `ai-service`
3. `backend-java`
4. `frontend-admin`
5. `frontend-visitor`

### 1. 启动 Qdrant

如果你只想启动向量库：

```bash
docker run -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/storage/qdrant:/qdrant/storage \
  qdrant/qdrant
```

健康检查：

```bash
curl http://127.0.0.1:6333/healthz
```

### 2. 启动统一 AI 服务

`ai-service` 是统一入口，启动一次即可，不需要分别启动 `RAG`、`TTS` 等脚本。

```bash

source .venv/bin/actcd ai-serviceivate
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

健康检查：

```bash
curl http://127.0.0.1:8000/health
```

当前统一 AI 服务对外提供的核心接口包括：

- `POST /kb/documents/upload`
- `GET /kb/documents`
- `POST /kb/ingest`
- `POST /rag/retrieve`
- `POST /rag/query`
- `POST /tts`
- `GET /voices`

### 3. 启动 Java 后端

```bash
cd backend-java
./mvnw spring-boot:run
```

默认地址：

```text
http://127.0.0.1:8080
```

### 4. 启动管理后台

```bash
cd frontend-admin
npm run dev
```

默认地址通常是：

```text
http://localhost:5174
```

### 5. 启动游客端

```bash
cd frontend-visitor
cp .env.example .env.local
# 在 .env.local 中填写 VITE_AMAP_KEY 与 VITE_AMAP_SECURITY_KEY
pnpm dev
```

地图页面通过 `VITE_AMAP_KEY` 和 `VITE_AMAP_SECURITY_KEY` 读取高德地图配置。两者（包括 `securityJsCode`）都会由 Vite 写入浏览器 bundle，属于客户端配置，并不是真正能保密的服务端 secret；不要把它们当作仅靠 `.env.local` 就能隐藏的凭据。生产环境必须在高德控制台绑定允许访问的生产域名、限制调用配额，并为开发、测试、生产环境分别使用独立 Key，以便单独轮换和吊销。值应写入本地 `.env.local` 或部署平台环境变量，不要把具体值提交到仓库。未配置时，地图区域会提示联系管理员；只有 SDK 瞬时加载失败时才提供重新加载入口，且两者都不会导致整个游客端崩溃。

后端会为每个请求返回 `X-Trace-Id`。调用方可以传入 8–128 位、仅包含字母、数字、点、下划线、冒号或连字符的标识；缺失或非法时后端会生成 UUID。

默认地址通常是：

```text
http://localhost:5173
```

## 验证记录

全系统升级的最新可复现验证结果、未执行项与剩余风险见：

- [docs/verification/2026-07-11-full-system-upgrade.md](docs/verification/2026-07-11-full-system-upgrade.md)

## Docker Compose

如果你想一键启动 `Qdrant + ai-service`：

```bash
cd ai-service
docker compose up -d --build
```

停止：

```bash
cd ai-service
docker compose down
```

注意：当前 `ai-service/docker-compose.yml` 只编排了：

- `qdrant`
- `ai-service`

还没有把 `backend-java`、`frontend-admin`、`frontend-visitor` 一起编排进去。

## 知识库管理流程

现在知识库是你要求的两步式流程，不是上传即构建。

### 后台管理流程

1. 在管理后台上传文件
2. 文件保存到知识库目录
3. 点击“开始构建”
4. `backend-java` 调用 `ai-service`
5. `ai-service` 执行：
   - 文档解析
   - 片段拆分
   - Embedding
   - 写入 Qdrant

### 管理后台接口

- `POST /api/admin/knowledge/documents/upload`
  - 只上传，不构建
- `GET /api/admin/knowledge/documents`
  - 查看已上传文件
- `POST /api/admin/knowledge/build`
  - 开始构建知识库

普通构建请求：

```json
{}
```

全量重建请求：

```json
{
  "recreateCollection": true
}
```

### AI 服务对应接口

- `POST /kb/documents/upload`
  - 只保存文件
- `POST /kb/ingest`
  - 对当前知识库目录执行构建

手动触发全量重建示例：

```bash
curl -X POST http://127.0.0.1:18755/kb/ingest \
  -H 'Content-Type: application/json' \
  -d '{"recreate_collection":true}'
```

## 管理后台页面

当前管理后台知识库页已经接好：

- 上传文件
- 开始构建
- 全量重建
- 文件列表
- 最近一次构建结果统计

页面入口：

[frontend-admin/src/App.tsx](/Users/zhangzesheng/Desktop/zzs/github/DigitalHuman/frontend-admin/src/App.tsx:1)

## 重要说明

- 独立 TTS 服务入口已迁到 `ai-service/model_capabilities/tts/service_app.py`
- 统一 AI 服务入口是 `ai-service/app.py`
- TTS 已并入 `ai-service`
- 前端游客端代理也已经从旧的 `18754` 切到统一的 `18755`

## 目前未完成项

- `backend-java` 数据库环境的完整落地
- 全链路运行验证
- `backend-java` 进入 `docker-compose`
- 更细的知识库构建状态持久化

## 常用检查

检查 Qdrant：

```bash
curl http://127.0.0.1:6333/healthz
```

检查 AI 服务：

```bash
curl http://127.0.0.1:18755/health
```

查看知识库文件：

```bash
curl http://127.0.0.1:18755/kb/documents
```

手动构建知识库：

```bash
curl -X POST http://127.0.0.1:18755/kb/ingest \
  -H 'Content-Type: application/json' \
  -d '{}'
```
## AI 配置指南

本项目包含两块 AI 能力：

| 能力 | 服务 | 说明 |
|------|------|------|
| **AI 文字回复** | backend-java → ai-service → 大模型 API | 让数字人能对话 |
| **AI 语音合成（TTS）** | 前端 → ai-service `/tts` | 让数字人能说话 |

**⚠️ 重要**：项目本身**不包含**任何 AI API Key。每位使用者需要**自己申请 Key** 并配置。

---

### 一、准备工作

#### 1. 环境变量配置

复制 `ai-service/.env.example` 为 `ai-service/.env`：

```bash
cd ai-service
cp .env.example .env
```

编辑 `.env`，设置 `AI_SERVICE_ADMIN_TOKEN`：

```
AI_SERVICE_ADMIN_TOKEN=your-random-token-2026
```

**要求**：
- 长度至少 20 字符
- 随便设一个随机字符串，**不需要和别人共享**
- 例：`digitalhuman-2026-a7b9c4d1e8f2`

**同时**在系统里设置**同名环境变量**（backend-java 也读这个变量）：

**Windows (PowerShell)**：
```powershell
[System.Environment]::SetEnvironmentVariable("AI_SERVICE_ADMIN_TOKEN","your-random-token-2026","User")
```

**macOS / Linux**：
```bash
export AI_SERVICE_ADMIN_TOKEN=your-random-token-2026
```

**⚠️ 两个地方值必须完全一致**，否则后端调 ai-service 会报 401。

#### 2. 申请 AI API Key

推荐使用以下任一平台（都有免费额度或低成本）：

| 平台 | 免费额度 | 申请地址 |
|------|---------|---------|
| **智谱 AI** | ✅ 2000 万 Tokens 免费 | https://open.bigmodel.cn |
| **DeepSeek** | ❌ 需充值（几块钱起） | https://platform.deepseek.com |

**申请后，复制 API Key**（形如 `sk-xxxx` 或 `xxxx.yyyy`），**保存好**，下一步用。

---

### 二、启动服务

按顺序启动 4 个服务：

#### 1. 后端（backend-java）

```bash
cd backend-java
mvn spring-boot:run
```

端口：`8080`

#### 2. AI 服务（ai-service）

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate     # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

端口：`8000`

**健康检查**：
```bash
curl http://127.0.0.1:8000/health
```

#### 3. 管理后台（frontend-admin）

```bash
cd frontend-admin
npm install
npm run dev
```

#### 4. 游客端（frontend-visitor）

```bash
cd frontend-visitor
npm install
npm run dev
```

---

### 三、配置 AI 文字回复

**方法A:通过管理后台（推荐）**

1. 浏览器打开 `http://localhost:5241/admin/ai-models`
2. 在「模型配置」里填入：
   - **服务商**：`DeepSeek` 
   - **模型名称**：`deepseek-chat` 
   - **API 地址**：
     - DeepSeek：`https://api.deepseek.com/v1`
   - **API Key**：粘贴你自己的 Key
3. 点「保存配置」



**方式 B：直接改数据库**

```sql
USE digitalhuman;

UPDATE admin_provider_config
SET api_key = '<你的真实 API Key>',
    base_url = 'https://api.deepseek.com/v1',
    provider = 'deepseek',
    protocol = 'openai_compatible'
WHERE id = 2;

-- 确保 admin_model_config 也一致
UPDATE admin_model_config
SET provider = 'deepseek',
    model_id = 'deepseek-chat'
WHERE id = 1;
```

---

### 四、绑定 Agent 到模型

**必须把 agent 绑定到模型**，否则 AI 会返回"智能体不可用"。

**在 `/docs` 里调 `PUT /agents/model-bindings`**：

1. 浏览器打开 `http://localhost:8000/docs`
2. 找到 `PUT /agents/model-bindings`
3. 点 `Try it out`
4. 在 `X-Service-Token` 填入你的 `AI_SERVICE_ADMIN_TOKEN`
5. `Request body` 填：

```json
{
  "items": [
    {
      "agent": "guide_script_agent",
      "category": "chat",
      "provider": "deepseek",
      "model": "deepseek-chat",
      "timeoutSeconds": 90,
      "enabled": true
    },
    {
      "agent": "scenic_structured_agent",
      "category": "chat",
      "provider": "deepseek",
      "model": "deepseek-chat",
      "timeoutSeconds": 90,
      "enabled": true
    },
    {
      "agent": "travel_analytics_agent",
      "category": "multimodal",
      "provider": "deepseek",
      "model": "deepseek-chat",
      "timeoutSeconds": 90,
      "enabled": true
    }
  ]
}
```

6. 点 `Execute`
### 五、配置 AI 语音（TTS）

**TTS 语音服务由 ai-service 自带**，无需额外启动服务。

**前置条件**：
- `ai-service` 已启动，监听 `8000`
- 前端 `frontend-visitor` 的 `vite.config.ts` 里，`/edge-tts` 代理指向 `http://127.0.0.1:8000`

**检查配置**：

打开 `frontend-visitor/vite.config.ts`，确认：

```typescript
server: {
  proxy: {
    '/edge-tts': {
      target: 'http://127.0.0.1:8000',    // 必须指向 ai-service
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/edge-tts/, ''),
    }
  }
}
```

**验证 TTS**：

在 `/docs` 里测 `POST /tts`：

- Request body：
```json
{
  "text": "你好，欢迎来到灵山胜境",
  "voice": "zh-CN-XiaoxiaoNeural"
}
```

- 期望返回：`200` + 音频文件（`audio/mpeg`）

---

### 六、验证完整功能

1. 打开游客端：`http://localhost:30001/modules/digital-human`
2. 在对话框输入"你好"
3. **验证文字回复**：应该收到真实 AI 回复（不是兜底话术）
4. **验证语音**：应该听到数字人语音播放（或点击喇叭按钮）

**F12 网络面板**应看到：
- `POST /agents/leader/chat/stream` → `200`
- `POST /edge-tts/tts` → `200`

---

### 七、常见问题

#### Q1：提示"当前主智能体暂时不可用"

**原因**：agent bindings 没配，或者 provider 名不匹配。

**解决**：检查第四节的 agent bindings 是否已配好，且 `provider` 与 `admin_provider_config` 表里的 `provider` 名一致（大小写敏感）。

#### Q2：AI 回复"服务暂时繁忙"

**原因**：provider 配置的 API Key 无效或余额不足。

**验证**：用 PowerShell 直接测 Key：

```powershell
$key = "<你的 API Key>"
$body = @{
    model = "deepseek-chat"
    messages = @(@{role="user"; content="你好"})
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
    -Uri "https://api.deepseek.com/v1/chat/completions" `
    -Method POST `
    -Headers @{ "Authorization" = "Bearer $key" } `
    -ContentType "application/json" `
    -Body $body
```

- `200` → key 有效
- `401` → key 无效
- `402` → 余额不足（需充值）

#### Q3：语音没声音，F12 看到 `tts 502`

**原因**：前端 `/edge-tts` 代理指向 `18755` 但 ai-service 在 `8000`。

**解决**：改 `frontend-visitor/vite.config.ts` 的 target 为 `http://127.0.0.1:8000`，重启前端。

#### Q4：`/docs` 调用报 401 `service token required`

**原因**：`X-Service-Token` 填错，或 ai-service 没读到 `.env`。

**解决**：
- 确认 `.env` 里的 `AI_SERVICE_ADMIN_TOKEN`
- 重启 ai-service
- 在 `/docs` 的 `X-Service-Token` 填**同一个值**

#### Q5：数据库里 provider 名大小写不一致

**原因**：有的地方写 `DeepSeek`，有的写 `deepseek`。

**解决**：统一成**小写** `deepseek` 或 `zhipu`：

```sql
UPDATE admin_provider_config SET provider = LOWER(provider);
UPDATE admin_model_config SET provider = LOWER(provider);
```

---

### 八、安全提示

**⚠️ 绝对不要做的事**：

1. ❌ 不要把真实 API Key 写进 README、代码、`application.yml`
2. ❌ 不要把 `.env` 文件提交到 GitHub
3. ❌ 不要把 Key 截图发到聊天、群里
4. ❌ 不要在公开仓库用别人的 Key

**✅ 正确做法**：

- API Key 只存在 `.env`、数据库、系统环境变量里
- `.env` 已在 `.gitignore` 里
- 上传 GitHub 前跑一次检查：
  ```bash
  git grep -i "sk-" 2>$null
  ```
  确认没有真 Key 被跟踪
