# DigitalHuman 项目启动文档

## 1. 项目目标

本项目面向“景区数字人智能导览”比赛场景，采用前后端分离 + AI 服务解耦的架构，优先实现以下核心能力：

- 游客端文本/语音提问
- 基于景区知识库的 RAG 问答
- 数字人语音播报与基础表情切换
- 管理后台的知识库管理、问答记录查看、数据统计

第一阶段不追求一次性做全，先跑通最小可演示闭环：

1. 游客端输入问题
2. 后端转发给 AI 服务
3. AI 服务完成知识检索和回答生成
4. TTS 合成语音
5. 前端播放语音并驱动数字人状态
6. 问答记录写入数据库

---

## 2. 推荐目录结构

```text
DigitalHuman/
├─ frontend-visitor/          # 游客端
├─ frontend-admin/            # 管理后台
├─ backend-java/              # Spring Boot 业务服务
├─ ai-service/                # Python FastAPI AI 服务
├─ knowledge-base/            # 景区文档原始资料
├─ storage/                   # 本地上传文件、音频、临时输出
├─ docker/                    # Docker 编排与中间件配置
└─ PROJECT_BOOTSTRAP.md
```

---

## 3. 技术栈落地版本

建议先按下面这套启动：

- 游客端：Vue 3 + TypeScript + Vite + Pinia + Vue Router
- 管理后台：Vue 3 + TypeScript + Vite + Element Plus + ECharts
- 业务后端：Spring Boot + MySQL + Redis
- AI 服务：Python + FastAPI + LangChain + FAISS
- 大模型：通义千问 API / Qwen API
- ASR：FunASR 或先用文本输入替代
- TTS：Edge-TTS 或 CosyVoice
- 数字人：Live2D
- 部署：Docker + Docker Compose + Nginx

---

## 4. 本地开发环境要求

建议环境版本：

- Node.js 20+
- pnpm 9+ 或 npm 10+
- JDK 17
- Maven 3.9+
- Python 3.11
- MySQL 8
- Redis 7
- Docker
- Docker Compose

检查命令：

```bash
node -v
pnpm -v
java -version
mvn -v
python3 --version
docker -v
docker compose version
```

---

## 5. 建议启动顺序

本项目不要一上来同时做所有模块，按下面顺序推进：

1. 先起中间件：MySQL、Redis
2. 再起 AI 服务：确认问答链路可用
3. 再起 Spring Boot：打通业务接口
4. 再起游客端：先文本问答
5. 再起管理后台：查看问答记录和知识库
6. 最后接 ASR、TTS、Live2D

---

## 6. 初始化项目骨架命令

### 6.1 创建目录

```bash
mkdir -p frontend-visitor frontend-admin backend-java ai-service knowledge-base storage docker
```

### 6.2 初始化游客端

```bash
pnpm create vite frontend-visitor --template vue-ts
cd frontend-visitor
pnpm install
pnpm add vue-router pinia axios
pnpm add -D sass
cd ..
```

### 6.3 初始化管理后台

```bash
pnpm create vite frontend-admin --template vue-ts
cd frontend-admin
pnpm install
pnpm add vue-router pinia axios element-plus echarts
pnpm add -D sass unplugin-auto-import unplugin-vue-components
cd ..
```

### 6.4 初始化 Spring Boot 后端

方式一：用 Spring Initializr 创建 `backend-java`

依赖建议：

- Spring Web
- Spring Data JPA
- MySQL Driver
- Validation
- Lombok
- Spring Security
- Redis

如果你已经有 Maven 工程，进入后安装依赖：

```bash
cd backend-java
mvn clean install
cd ..
```

### 6.5 初始化 Python AI 服务

```bash
mkdir -p ai-service
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn python-multipart pydantic requests
pip install langchain langchain-community faiss-cpu
pip install pymupdf pdfplumber python-docx
pip install edge-tts
cd ..
```

---

## 7. 中间件启动命令

如果本地已有 MySQL 和 Redis，可以直接使用本机服务。

如果没有，建议先用 Docker。

### 7.1 启动 MySQL

```bash
docker run -d \
  --name digitalhuman-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -e MYSQL_DATABASE=digitalhuman \
  -v $(pwd)/storage/mysql:/var/lib/mysql \
  mysql:8.0
```

### 7.2 启动 Redis

```bash
docker run -d \
  --name digitalhuman-redis \
  -p 6379:6379 \
  redis:7
```

### 7.3 检查容器状态

```bash
docker ps
```

---

## 8. AI 服务启动方式

### 8.1 建议 AI 服务职责

- `/chat`
- `/rag/query`
- `/tts`
- `/asr`
- `/emotion/analyze`

### 8.2 启动命令

```bash
cd ai-service
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

如果你先只做最小演示版本，建议优先实现：

- `/rag/query`
- `/tts`

### 8.3 环境变量示例

在 `ai-service/.env` 中配置：

```env
QWEN_API_KEY=your_api_key
EMBEDDING_MODEL=bge-small-zh
VECTOR_DB=faiss
KNOWLEDGE_DIR=../knowledge-base
OUTPUT_DIR=../storage/audio
```

---

## 9. Spring Boot 后端启动方式

### 9.1 后端职责

- 用户接口
- 管理后台接口
- 问答记录保存
- 反馈保存
- 景区资料上传
- 调用 AI 服务

### 9.2 启动命令

```bash
cd backend-java
mvn spring-boot:run
```

如果是打包运行：

```bash
cd backend-java
mvn clean package -DskipTests
java -jar target/*.jar
```

### 9.3 配置示例

`application.yml` 建议至少包含：

```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:mysql://127.0.0.1:3306/digitalhuman?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
    username: root
    password: 123456
  data:
    redis:
      host: 127.0.0.1
      port: 6379

ai:
  service:
    base-url: http://127.0.0.1:8001
```

---

## 10. 前端启动方式

### 10.1 游客端启动

```bash
cd frontend-visitor
pnpm install
pnpm dev --host 0.0.0.0 --port 5173
```

### 10.2 管理后台启动

```bash
cd frontend-admin
pnpm install
pnpm dev --host 0.0.0.0 --port 5174
```

### 10.3 前端生产构建

```bash
cd frontend-visitor
pnpm build

cd ../frontend-admin
pnpm build
```

---

## 11. 第一版接口联调建议

建议先只打通以下接口：

### 11.1 游客端

- `POST /api/chat`
- `POST /api/feedback`
- `GET /api/scenic-spots`

### 11.2 管理后台

- `POST /admin/knowledge/upload`
- `GET /admin/qa-records`
- `GET /admin/dashboard/stats`

### 11.3 Spring Boot 调 AI 服务

```text
游客端 -> Spring Boot -> FastAPI -> RAG/LLM/TTS -> Spring Boot -> 游客端
```

第一版不要让前端直接调 AI 服务，统一由 Spring Boot 转发，方便后期做权限、日志、统计。

---

## 12. 知识库初始化命令

先把景区文档放入：

```bash
knowledge-base/
```

例如：

- 景点介绍 PDF
- 历史文化资料 DOCX
- 讲解词 TXT
- FAQ CSV

如果后续做向量化脚本，建议预留命令：

```bash
cd ai-service
source .venv/bin/activate
python scripts/build_index.py
```

建议该脚本完成：

1. 扫描 `knowledge-base/`
2. 解析 PDF/DOCX/TXT
3. 文本切分
4. 向量化
5. 生成本地 FAISS 索引

---

## 13. 推荐的本地联调顺序

### 13.1 终端一：MySQL

```bash
docker start digitalhuman-mysql
```

### 13.2 终端二：Redis

```bash
docker start digitalhuman-redis
```

### 13.3 终端三：AI 服务

```bash
cd ai-service
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 13.4 终端四：Spring Boot

```bash
cd backend-java
mvn spring-boot:run
```

### 13.5 终端五：游客端

```bash
cd frontend-visitor
pnpm dev --host 0.0.0.0 --port 5173
```

### 13.6 终端六：管理后台

```bash
cd frontend-admin
pnpm dev --host 0.0.0.0 --port 5174
```

---

## 14. 第一阶段最小可交付版本

建议你先只做这几个页面和能力：

### 游客端

- 首页
- 问答页
- 文本输入
- 语音播放
- 数字人基础待机/说话状态

### 管理后台

- 登录页
- 知识库上传页
- 问答记录页
- 数据统计页

### 后端

- 问答接口
- 文档上传接口
- 问答记录保存
- 数据统计接口

### AI 服务

- RAG 检索问答
- TTS 语音输出

这样最容易在比赛里先跑出完整演示。

---

## 15. 第二阶段增强项

在第一阶段跑通后，再逐步增加：

- FunASR 语音识别
- 情绪分析
- 路线推荐
- 图片识别问答
- 多景点讲解切换
- Live2D 表情细化
- 管理后台数据大屏
- Docker Compose 一键启动

---

## 16. 最后推荐的一键启动目标

等项目骨架稳定后，再补一个 `docker-compose.yml`，目标做到：

```bash
docker compose up -d
```

即可启动：

- nginx
- mysql
- redis
- backend-java
- ai-service
- frontend-visitor
- frontend-admin

---

## 17. 当前最建议你马上执行的命令

如果现在从 0 开始，我会先执行这几步：

```bash
mkdir -p frontend-visitor frontend-admin backend-java ai-service knowledge-base storage docker
pnpm create vite frontend-visitor --template vue-ts
pnpm create vite frontend-admin --template vue-ts
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn langchain langchain-community faiss-cpu edge-tts pymupdf pdfplumber python-docx
cd ..
docker run -d --name digitalhuman-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=123456 -e MYSQL_DATABASE=digitalhuman mysql:8.0
docker run -d --name digitalhuman-redis -p 6379:6379 redis:7
```

然后再开始分别补：

1. Vue 页面骨架
2. Spring Boot 接口骨架
3. FastAPI RAG 服务骨架
4. 数据库表结构
5. 知识库导入脚本

---

## 18. 下一步建议

如果继续往下做，下一步最合理的是直接生成以下内容：

1. 项目完整目录骨架
2. `docker-compose.yml`
3. Spring Boot 初始工程结构
4. FastAPI 初始工程结构
5. 前端游客端和后台初始化页面

如果你要，我下一步可以直接继续帮你把这个项目的第一版目录和启动骨架一次性搭出来。
