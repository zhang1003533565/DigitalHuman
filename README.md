# DigitalHuman

景区数字人项目初始化仓库，当前采用以下技术栈：

- `frontend-visitor`：React + Vite + TypeScript
- `frontend-admin`：React + Vite + TypeScript
- `backend-java`：Spring Boot
- `ai-service`：FastAPI

当前仓库已经完成基础目录和项目初始化，适合作为后续开发起点。

## 目录说明

```text
DigitalHuman/
├─ frontend-visitor/      # 游客端前端
├─ frontend-admin/        # 管理后台前端
├─ backend-java/          # Spring Boot 后端
├─ ai-service/            # FastAPI AI 服务
├─ knowledge-base/        # 知识库原始资料
├─ storage/               # 本地上传、音频、临时文件
└─ docker/                # Docker 配置
```

## 环境要求

建议本地环境：

- Node.js 20+
- pnpm 9+ 或 npm 10+
- JDK 17
- Maven 3.9+
- Python 3.11

可先检查：

```bash
node -v
pnpm -v
npm -v
java -version
mvn -v
python3 --version
```

## 首次安装

### 1. 游客端

```bash
cd frontend-visitor
pnpm install
cd ..
```

如果你使用 `npm`：

```bash
cd frontend-visitor
npm install
cd ..
```

### 2. 管理后台

```bash
cd frontend-admin
npm install
cd ..
```

如果你想统一成 `pnpm`，可以删除 `package-lock.json` 后重新安装。

### 3. AI 服务

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..
```

### 4. Spring Boot 后端

```bash
cd backend-java
./mvnw clean install
cd ..
```

如果你本机没有给数据库做配置，`mvn test` 或 `mvn clean install` 可能会因为数据源未配置失败，这属于当前初始化阶段的正常现象。

## 启动步骤

建议按下面顺序启动：

### 1. 启动游客端

```bash
cd frontend-visitor
pnpm dev
```

默认开发地址通常是：

```text
http://localhost:5173
```

### 2. 启动管理后台

```bash
cd frontend-admin
npm run dev
```

默认开发地址通常是：

```text
http://localhost:5174
```

如果端口被占用，Vite 会自动顺延端口。

### 3. 启动 Spring Boot 后端

```bash
cd backend-java
./mvnw spring-boot:run
```

默认端口通常是：

```text
http://localhost:8080
```

说明：

- 当前后端还是初始化骨架
- 后续如果接入 MySQL，需要补充 `application.properties` 或 `application.yml`

### 4. 启动 FastAPI AI 服务

`ai-service` 的入口文件是 `app.py`，不是 `main.py`。

首次启动前，先准备环境变量：

```bash
cd ai-service
cp .env.example .env
```

如果你想一键启动统一 AI 服务（`Qdrant + ai-service`），直接在仓库根目录执行：

```bash
docker compose up -d --build
```

停止：

```bash
docker compose down
```

统一服务地址配置放在：

[`config/application-shared.properties`](/Users/zhangzesheng/Desktop/zzs/github/DigitalHuman/config/application-shared.properties:1)

例如：

```properties
app.backend-base-url=http://127.0.0.1:8080
app.ai-service-url=http://127.0.0.1:18755
app.qdrant-url=http://127.0.0.1:6333
```

`backend-java` 和 `ai-service` 都会读取这份共享配置；`ai-service/.env` 只保留本地覆盖项。

如果你需要完整的向量检索能力，还要先启动 Qdrant：

```bash
docker run -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/storage/qdrant:/qdrant/storage \
  qdrant/qdrant
```

然后启动 FastAPI 服务：

```bash
cd ai-service
source .venv/bin/activate
python -m uvicorn app:app --host 127.0.0.1 --port 18755 --reload
```

默认端口：

```text
http://127.0.0.1:18755
```

可用下面命令检查服务是否启动成功：

```bash
curl http://127.0.0.1:18755/health
```

首次把仓库内 `knowledge-base/` 的资料导入 Qdrant：

```bash
curl -X POST http://127.0.0.1:18755/kb/ingest \
  -H 'Content-Type: application/json' \
  -d '{"recreate_collection":true}'
```

后台上传知识库文件时，Java 后端会转发到 `ai-service` 的 `/kb/documents/upload`，保存后立即执行入库，不需要你再手动单独构建。
TTS 也已经并入同一个 `ai-service` 入口，Java 后端默认改为调用 `http://127.0.0.1:18755/tts`。

## 当前状态

当前已经完成：

- React 游客端初始化
- React 管理后台初始化
- Spring Boot 项目初始化
- FastAPI 服务入口与 RAG API
- 各目录 `.gitignore` 配置

当前还未完成：

- `backend-java` 数据库配置
- 前后端接口联调
- Docker 编排文件

## 推荐下一步

建议下一步按这个顺序继续：

1. 完成 `ai-service/.env` 中的模型与密钥配置
2. 在 `backend-java` 增加基础健康检查接口
3. 前端接一个最小测试页面
4. 再做前后端联调
