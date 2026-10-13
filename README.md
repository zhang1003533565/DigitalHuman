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

启动 ai-service

ai-service 是统一入口，**启动一次即可**，不需要分别启动 RAG、TTS 等脚本。

#### Linux / macOS

```bash
cd ai-service
source .venv/bin/activate
python -m uvicorn app:app --host 127.0.0.1 --port 18755 --reload

#### windows
cd ai-service
.\.venv\Scripts\Activate.ps1
py -m uvicorn app:app --host 127.0.0.1 --port 18755 --reload

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

## 景区商城（农产品 + 周边产品）

游客端可以浏览景区商城、加购物车并提交订单；管理后台可以维护商品与管理订单。当前范围为
**商品浏览 + 购物车 + 下单**，只生成订单记录，**不接入真实支付渠道**。

### 商品分类

| 分类标识 | 中文名 | 示例 |
|---------|--------|------|
| `farm` | 农产品 | 坝上莜面、口蘑干货、黄米糕、张垣熏肉 |
| `souvenir` | 周边产品 | 大境门文创冰箱贴、长城主题书签、主题明信片、帆布袋 |

商品库不再写入任何示例商品：启动时不会自动往 `mall_product` 表里塞数据，
商品一律由管理后台（`frontend-admin` 的商品管理页）录入维护。表为空时游客端商城
显示空状态，这是预期行为。

### 游客端接口

需要 `USER` 角色（`Authorization: Bearer <token>`）：

- `GET /api/user/mall/products?category=&keyword=`
  - `category` 省略或传 `all` 表示全部；支持 `farm` / `souvenir`
- `GET /api/user/mall/products/{id}`
  - 已下架商品返回 404
- `POST /api/user/mall/orders`
  - 下单，请求体只包含 `productId` 与 `quantity`，**金额由服务端按库中当前价计算**
- `GET /api/user/mall/orders`
  - 只返回当前登录用户自己的订单
- `GET /api/user/mall/orders/{id}`
- `POST /api/user/mall/orders/{id}/cancel`
  - 仅 `PENDING` 状态可取消，取消后自动回滚库存

下单请求示例：

```json
{
  "receiverName": "小明",
  "receiverPhone": "13800000000",
  "receiverAddress": "张家口市桥西区大境门景区",
  "remark": "请尽快发货",
  "items": [
    { "productId": "mall-p-1", "quantity": 2 },
    { "productId": "mall-p-5", "quantity": 1 }
  ]
}
```

### 管理后台接口

需要 `ADMIN` 角色（`OBSERVER` 只能执行 GET）：

- `GET /api/admin/mall/products`
- `GET /api/admin/mall/products/{id}`
- `POST /api/admin/mall/products`
- `PUT /api/admin/mall/products/{id}`
- `DELETE /api/admin/mall/products/{id}`
- `POST /api/admin/mall/products/image`
  - `multipart/form-data`，字段名 `file`，支持 PNG / JPG / JPEG / WebP
  - 复用 `/api/scenic-media/**` 静态映射返回可访问 URL
- `GET /api/admin/mall/orders`
- `GET /api/admin/mall/orders/{id}`
- `PUT /api/admin/mall/orders/{id}/status`

订单状态取值：`PENDING`（待处理）、`CONFIRMED`（已确认）、`COMPLETED`（已完成）、`CANCELLED`（已取消）。
`COMPLETED` 与 `CANCELLED` 为终态，不可再变更；取消操作幂等，库存只回滚一次。

### 数据表

三张表由 JPA `ddl-auto: update` 自动创建，无需手工执行建表脚本：

- `mall_product`：商品（价格、划线价、库存、单位、图片、详情、标签、排序、上下架）
- `mall_order`：订单（订单号、用户、状态、金额、收货信息、备注、取消原因）
- `mall_order_item`：订单明细（下单时的商品快照，商品改价或删除不影响历史订单）

### 关键行为约束

- **订单归属只认登录会话**：`userId` 取自服务端 `AuthSession`，请求体传 `userId` 无效。
- **金额服务端重算**：客户端提交的价格字段会被完全忽略，防止篡改金额。
- **整单成败**：先全量校验商品是否上架、库存是否足够，全部通过后才扣减库存，因此不会出现部分扣减。
- **并发不超卖**：库存扣减走原子条件 UPDATE（`deductStock`），判断与扣减在同一条 SQL 内完成：

  ```sql
  update mall_product set stock = stock - ?
   where id = ? and stock >= ? and enabled = true
  ```

  受影响行数为 0 即表示库存不足，整单回滚。**不要改回"先 select 再 setStock"的写法**——
  Hibernate 对已在一级缓存中的实体会直接返回缓存对象而不发 SQL，加锁查询会被跳过：
  实测 40 并发抢 10 件库存时，该写法会让 40 单全部成功、库存变成 -30。
  回归测试见 `MallConcurrentOrderTests`。
- **库存保护**：同一商品重复提交多行会先合并数量再校验；下单数量上限 99 件（按**合并后**总量计）。
- **越权隔离**：查询他人订单返回 404（不区分"不存在"与"非本人"），避免订单号枚举。
- **购物车只存在浏览器本地**（`localStorage` 键 `digitalhuman.mall.cart`），不落服务端。
  - 进入商城时用最新商品数据刷新购物车快照（价格、库存、数量上限），减少下单时才失败的情况。
  - 刷新遇到下架/售罄商品时会移出购物车，但**不会**因为搜索或分类筛选把未出现在列表里的商品删掉。
- **错误响应统一带 message**：见下方"统一错误响应"。

### 统一错误响应

新增 `ApiExceptionHandler`（`@RestControllerAdvice`），把业务异常与参数校验异常统一成：

```json
{ "code": "NOT_FOUND", "message": "商品不存在或已下架", "traceId": "..." }
```

**背景**：项目原先依赖 `server.error.include-message: always` 让 Spring Boot 的 `/error` 端点回显
`ResponseStatusException` 的 reason，但实测响应体里只有 `timestamp/status/error/path`，**没有 message 字段**。
游客端 `getApiProblem` 只读 `payload.message` 与 `payload.detail`，因此所有业务提示（如"库存不足：坝上莜面（剩余 5）"、
"请输入 11 位手机号"）都会退化成通用兜底文案。现在由 advice 显式返回 message 与 traceId，不再依赖该配置项。

该修复对所有模块生效（例如既有登录、景点、反馈等接口的报错文案也会一并恢复可读）。

### 页面入口

- 游客端：顶部导航「景区商城」→ `/mall`，商品详情 `/mall/products/:id`；用户菜单「我的订单」→ `/orders`
- 管理后台：侧边栏「景区商城」→ 商品管理 `/admin/mall/products`、订单管理 `/admin/mall/orders`

### 相关测试

```bash
# 后端（含商城服务、控制器、持久化、并发不超卖与图片上传）
cd backend-java && ./mvnw test

# 只跑商城相关测试
cd backend-java && ./mvnw test -Dtest='Mall*Tests,ApiExceptionHandlerTests'

# 游客端商城页面与购物车契约
cd frontend-visitor && node src/mall/cartStore.test.mjs && node src/pages/mallPageContract.test.mjs

# 管理后台商城接口与菜单契约
cd frontend-admin && node src/api/mall.test.mjs && node src/pages/mallContract.test.mjs
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
