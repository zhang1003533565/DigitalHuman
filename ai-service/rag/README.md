# RAG 目录说明

这个目录现在按更通用、见名知意的方式拆成了几层：

## 1. `application/`

应用服务层。

当前文件：

- `rag_service.py`

职责：

- 对外提供统一的 RAG 入口
- 编排 ingest / retrieve / query 业务流程
- 组合配置、检索、向量库、生成式回答

## 2. `config/`

配置层。

当前文件：

- `settings.py`

职责：

- 统一读取环境变量和共享配置
- 定义 `RagSettings`

## 3. `graph/`

LangGraph 工作流层。

当前文件：

- `query_graph.py`

职责：

- 用节点和边编排 RAG 查询流程
- 把记忆读取、查询改写、检索、上下文判断、二次检索、生成、答案质检、引用校验、人工审核、响应整理拆成可扩展节点
- 优先使用 SQLite LangGraph checkpoint 按 `sessionId` 保存线程状态，未安装 SQLite saver 时回退到内存 checkpoint
- 通过 SQLite 保存最近多轮问答，用于追问改写，服务重启后仍可继续按 `sessionId` 读取历史

当前查询图：

```text
load_memory
  -> rewrite_query
  -> retrieve
  -> judge_context
  -> generate
  -> answer_quality_check
  -> citation_validation
  -> prepare_response
  -> END

judge_context --上下文不足--> second_retrieve -> generate
answer_quality_check --未通过--> fallback_answer -> citation_validation
citation_validation --需要审核--> human_review -> prepare_response
```

节点说明：

- `load_memory`：按 `sessionId` 读取最近多轮问答
- `rewrite_query`：结合历史对话改写当前问题，适配追问和省略主语的场景
- `retrieve`：调用 `retrieval/` 里的统一检索器，完成向量召回和 rerank
- `judge_context`：判断召回结果是否足够支撑回答
- `second_retrieve`：上下文不足时扩展查询并二次检索
- `generate`：调用 `rag/llm.py`，再由 `model_providers/` 出口访问具体模型供应商
- `answer_quality_check`：检查答案长度、是否有可用知识片段支撑
- `fallback_answer`：当 LLM 未配置、无回答或调用失败时，使用知识片段生成兜底回答
- `citation_validation`：检查并补齐 `来源：文件名 / 标题` 格式引用
- `human_review`：当启用人工审核且质量/引用/上下文存在风险时触发 LangGraph interrupt
- `prepare_response`：整理来源、相关景点和最终响应字段

运行说明：

- 请求体可传 `sessionId`，用于多轮记忆和 checkpoint 线程 ID
- 请求体可传 `enableHumanReview: true`，当上下文、质量或引用存在风险时会触发 interrupt
- SQLite checkpoint 文件默认写入 `ai-service/rag/.runtime/rag_checkpoints.sqlite`
- SQLite 多轮记忆文件默认写入 `ai-service/rag/.runtime/rag_memory.sqlite`

当前 `/rag/query` 已返回以下调试字段，方便后续后台页面展示每次 RAG 的执行情况：

- `rewrittenQuestion`：最终用于检索的查询
- `contextSufficient` / `contextReason`：检索结果是否足够，以及不足原因
- `qualityPassed` / `qualityIssues`：答案质量检查结果和原因
- `citationsValid` / `citationIssues`：引用格式和来源校验结果
- `reviewRequired` / `reviewReason`：是否需要人工审核
- `graphSteps`：本次执行经过的 LangGraph 节点
- `retrievalAttempts`：检索轮次，发生二次检索时为 2

## 4. `contracts/`

协议与数据结构层。

当前文件：

- `schemas.py`

职责：

- 定义 RAG 请求/响应模型
- 定义知识块、payload、上传响应、测试请求等结构

## 5. `ingestion/`

入库处理层。

当前文件：

- `parser.py`
- `chunker.py`

职责：

- 解析文档
- 切分 chunk
- 为后续 embedding 入库准备结构化内容

## 6. `retrieval/`

检索层。

当前文件：

- `embedder.py`
- `reranker.py`
- `retriever.py`
- `vectordb.py`

职责：

- 生成向量
- 重排序
- 检索召回
- 向量库读写

## 7. `generation/`

生成层。

当前文件：

- `prompts.py`

职责：

- 组织 grounded answer
- 负责生成前的文本拼装逻辑

## 8. `content/`

内容文件处理层。

当前文件：

- `file_store.py`

职责：

- 上传文件保存
- 目录确保
- 文件名与扩展名校验

## 9. 根目录保留文件

### `__init__.py`

对外导出：

- `RagService`
- `RagSettings`
- `get_settings`

### `llm.py`

这里当前保留为 RAG 侧的统一 LLM 出口。

职责：

- RAG 只认这一层
- 这一层再去找 `model_providers/` 里的具体供应商 client

也就是说：

- `rag` 保留统一入口
- `provider` 保留统一出口
- 供应商差异不直接散落在 `rag` 业务层里
