# DigitalHuman

景区数字人项目，当前由 4 个主要模块组成：

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
app.qdrant-url=http://127.0.0.1:6333
```

说明：

- `backend-java` 会导入这份配置
- `ai-service` 会先读取这份配置，再读取 `ai-service/.env`
- `ai-service/.env` 只建议放本地覆盖项，例如模型密钥

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
cd ai-service
source .venv/bin/activate
python -m uvicorn app:app --host 127.0.0.1 --port 18755 --reload
```

健康检查：

```bash
curl http://127.0.0.1:18755/health
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
