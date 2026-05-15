# DigitalHuman 初始化文档

## 1. 技术栈约定

本项目按下面的技术栈初始化：

- `frontend-visitor`：React + TypeScript + Vite
- `frontend-admin`：React + TypeScript + Vite
- `backend-java`：Spring Boot
- `ai-service`：FastAPI

---

## 2. 目录结构

```text
DigitalHuman/
├─ frontend-visitor/          # React 游客端
├─ frontend-admin/            # React 管理后台
├─ backend-java/              # Spring Boot 业务服务
├─ ai-service/                # FastAPI AI 服务
├─ knowledge-base/            # 景区知识库原始文件
├─ storage/                   # 上传文件、音频、临时输出
├─ docker/                    # Docker 配置
└─ PROJECT_INIT_REACT_SPRING_FASTAPI.md
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

## 4. 创建基础目录

如果目录还不存在，先执行：

```bash
mkdir -p frontend-visitor frontend-admin backend-java ai-service knowledge-base storage docker
```

---

## 5. 初始化 React 游客端

使用 `pnpm`：

```bash
pnpm create vite frontend-visitor --template react-ts
cd frontend-visitor
pnpm install
pnpm add react-router-dom axios zustand
pnpm add -D sass
cd ..
```

使用 `npm`：

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

使用 `pnpm`：

```bash
pnpm create vite frontend-admin --template react-ts
cd frontend-admin
pnpm install
pnpm add react-router-dom axios zustand antd @ant-design/icons echarts
pnpm add -D sass
cd ..
```

使用 `npm`：

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

`backend-java` 建议用 Spring Initializr 创建。

推荐参数：

- Project: Maven
- Language: Java
- Spring Boot: 3.x
- Group: `com.digitalhuman`
- Artifact: `backend-java`
- Name: `backend-java`
- Packaging: `jar`
- Java: `17`

推荐依赖：

- Spring Web
- Spring Data JPA
- Validation
- Lombok
- MySQL Driver
- Spring Data Redis
- Spring Security

### 7.1 方式一：网页生成

打开 Spring Initializr 生成项目后，把生成结果解压到：

```bash
backend-java/
```

### 7.2 方式二：使用 curl 下载骨架

```bash
curl https://start.spring.io/starter.zip \
  -d type=maven-project \
  -d language=java \
  -d bootVersion=3.3.12 \
  -d baseDir=backend-java \
  -d groupId=com.digitalhuman \
  -d artifactId=backend-java \
  -d name=backend-java \
  -d packaging=jar \
  -d javaVersion=17 \
  -d dependencies=web,data-jpa,validation,lombok,mysql,data-redis,security \
  -o backend-java.zip
```

然后解压：

```bash
unzip backend-java.zip
rm backend-java.zip
```

初始化完成后可验证：

```bash
cd backend-java
mvn clean install
cd ..
```

---

## 8. 初始化 FastAPI AI 服务

先创建虚拟环境并安装依赖：

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

如果你只想先完成最小 FastAPI 初始化，可先安装基础包：

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn
cd ..
```

---

## 9. 启动命令

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

启动 Spring Boot：

```bash
cd backend-java
mvn spring-boot:run
```

启动 FastAPI：

```bash
cd ai-service
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

---

## 10. 推荐初始化顺序

建议顺序：

1. 创建目录
2. 初始化 React 游客端
3. 初始化 React 管理后台
4. 初始化 Spring Boot
5. 初始化 FastAPI
6. 启动 MySQL 和 Redis
7. 联调前后端

---

## 11. 一次性命令参考

如果你准备按 `pnpm + Spring Boot + FastAPI` 这套走，可以参考下面顺序执行：

```bash
mkdir -p frontend-visitor frontend-admin backend-java ai-service knowledge-base storage docker
pnpm create vite frontend-visitor --template react-ts
pnpm create vite frontend-admin --template react-ts
cd frontend-visitor && pnpm install && pnpm add react-router-dom axios zustand && pnpm add -D sass && cd ..
cd frontend-admin && pnpm install && pnpm add react-router-dom axios zustand antd @ant-design/icons echarts && pnpm add -D sass && cd ..
cd ai-service && python3 -m venv .venv && source .venv/bin/activate && pip install --upgrade pip && pip install fastapi uvicorn python-multipart pydantic requests langchain langchain-community faiss-cpu pymupdf pdfplumber python-docx edge-tts && cd ..
```

Spring Boot 建议单独用 Spring Initializr 生成，不建议手写 Maven 骨架。
