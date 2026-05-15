# DigitalHuman React 初始化命令说明

## 1. 适用场景

如果你准备把游客端和管理后台都改成 React 技术栈，可以按这份文档初始化。

推荐前端方案：

- 游客端：React + TypeScript + Vite + React Router
- 管理后台：React + TypeScript + Vite + React Router + Ant Design

后端和 AI 服务保持不变：

- `backend-java`：Spring Boot 业务服务
- `ai-service`：Python FastAPI AI 服务

---

## 2. 目录结构

```text
DigitalHuman/
├─ frontend-visitor/          # React 游客端
├─ frontend-admin/            # React 管理后台
├─ backend-java/              # Spring Boot 业务服务
├─ ai-service/                # Python FastAPI AI 服务
├─ knowledge-base/            # 景区文档原始资料
├─ storage/                   # 本地上传文件、音频、临时输出
├─ docker/                    # Docker 编排与中间件配置
├─ PROJECT_BOOTSTRAP.md
└─ PROJECT_BOOTSTRAP_REACT.md
```

---

## 3. 环境要求

建议版本：

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
npm -v
java -version
mvn -v
python3 --version
docker -v
docker compose version
```

---

## 4. 初始化目录

如果目录还没创建，先执行：

```bash
mkdir -p frontend-visitor frontend-admin backend-java ai-service knowledge-base storage docker
```

---

## 5. 初始化 React 游客端

使用 Vite 创建 React + TypeScript 项目：

```bash
pnpm create vite frontend-visitor --template react-ts
cd frontend-visitor
pnpm install
pnpm add react-router-dom axios zustand
pnpm add -D sass
cd ..
```

如果你更想用 `npm`，对应命令如下：

```bash
npm create vite@latest frontend-visitor -- --template react-ts
cd frontend-visitor
npm install
npm install react-router-dom axios zustand
npm install -D sass
cd ..
```

---

## 6. 初始化 React 管理后台

同样使用 Vite 创建 React + TypeScript 项目：

```bash
pnpm create vite frontend-admin --template react-ts
cd frontend-admin
pnpm install
pnpm add react-router-dom axios zustand antd @ant-design/icons echarts
pnpm add -D sass
cd ..
```

如果使用 `npm`：

```bash
npm create vite@latest frontend-admin -- --template react-ts
cd frontend-admin
npm install
npm install react-router-dom axios zustand antd @ant-design/icons echarts
npm install -D sass
cd ..
```

---

## 7. 初始化 Spring Boot 后端

建议通过 Spring Initializr 创建 `backend-java` 项目。

推荐依赖：

- Spring Web
- Spring Data JPA
- MySQL Driver
- Validation
- Lombok
- Spring Security
- Spring Data Redis

如果项目已经创建完成，可执行：

```bash
cd backend-java
mvn clean install
cd ..
```

---

## 8. 初始化 Python AI 服务

```bash
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

## 9. 启动前端项目

启动游客端：

```bash
cd frontend-visitor
pnpm dev
```

启动管理后台：

```bash
cd frontend-admin
pnpm dev
```

如果使用 `npm`：

```bash
cd frontend-visitor
npm run dev
```

```bash
cd frontend-admin
npm run dev
```

---

## 10. 推荐初始化顺序

建议按下面顺序推进：

1. 创建目录结构
2. 初始化 React 游客端
3. 初始化 React 管理后台
4. 初始化 Spring Boot 后端
5. 初始化 AI 服务
6. 启动 MySQL 和 Redis
7. 联调游客端、后端、AI 服务

---

## 11. 一次性初始化命令参考

如果你已经决定全部使用 `pnpm`，可以按顺序执行：

```bash
mkdir -p frontend-visitor frontend-admin backend-java ai-service knowledge-base storage docker
pnpm create vite frontend-visitor --template react-ts
pnpm create vite frontend-admin --template react-ts
cd frontend-visitor && pnpm install && pnpm add react-router-dom axios zustand && pnpm add -D sass && cd ..
cd frontend-admin && pnpm install && pnpm add react-router-dom axios zustand antd @ant-design/icons echarts && pnpm add -D sass && cd ..
cd ai-service && python3 -m venv .venv && source .venv/bin/activate && pip install --upgrade pip && pip install fastapi uvicorn python-multipart pydantic requests langchain langchain-community faiss-cpu pymupdf pdfplumber python-docx edge-tts && cd ..
```

这条命令适合手动分段执行，不建议复制后一把跑到底，便于中途排查环境问题。
