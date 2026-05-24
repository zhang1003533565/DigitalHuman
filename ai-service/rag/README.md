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
- 把检索、生成、兜底回答、响应整理拆成可扩展节点
- 为后续增加查询重写、二次检索、答案质检、人工审核等步骤预留扩展点

当前查询图：

```text
retrieve -> generate -> prepare_response -> END
                    \-> fallback_answer -> prepare_response -> END
```

节点说明：

- `retrieve`：调用 `retrieval/` 里的统一检索器，完成向量召回和 rerank
- `generate`：调用 `rag/llm.py`，再由 `model_providers/` 出口访问具体模型供应商
- `fallback_answer`：当 LLM 未配置、无回答或调用失败时，使用知识片段生成兜底回答
- `prepare_response`：整理来源、相关景点和最终响应字段

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
