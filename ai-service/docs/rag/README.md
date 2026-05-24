# RAG Service

This service provides:

- knowledge base ingestion
- structured chunking
- Qdrant vector storage
- BGE-M3 embedding
- reranking
- DeepSeek-backed answer generation through an OpenAI-compatible API

## 1. Install dependencies

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2. Configure environment

Copy `.env.example` and fill in your DeepSeek API key:

```bash
cp .env.example .env
```

The service auto-loads `ai-service/.env`, so you do not need to manually `export` each variable.

Important settings:

- `RAG_LLM_BASE_URL=https://api.deepseek.com`
- `RAG_LLM_MODEL=deepseek-v4-pro`

As of May 20, 2026, DeepSeek's official docs show:

- OpenAI-compatible base URL: `https://api.deepseek.com`
- legacy models `deepseek-chat` and `deepseek-reasoner` will be deprecated on `2026-07-24`

## 3. Start Qdrant

If you want one-command startup for the unified AI layer (`Qdrant + ai-service`), use the repository root `docker-compose.yml`:

```bash
docker compose up -d --build
```

Then verify:

```bash
curl http://127.0.0.1:18755/health
curl http://127.0.0.1:6333/healthz
```

The same `ai-service` process now serves both RAG endpoints and TTS endpoints such as `/tts` and `/voices`.

Shared endpoint and model defaults live in:

[`config/application-shared.properties`](/Users/zhangzesheng/Desktop/zzs/github/DigitalHuman/config/application-shared.properties:1)

To stop:

```bash
docker compose down
```

## 3.1 Start Qdrant manually

Example with Docker:

```bash
docker run -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/../storage/qdrant:/qdrant/storage \
  qdrant/qdrant
```

## 4. Start the RAG API

```bash
cd ai-service
uvicorn app:app --host 127.0.0.1 --port 18755
```

Health check:

```bash
curl http://127.0.0.1:18755/health
```

## 5. Upload documents and ingest through the API

```bash
curl -X POST http://127.0.0.1:18755/kb/documents/upload \
  -F "file=@../knowledge-base/灵山胜境：历史、文化、景点特色与个性化游览指南.docx"
```

The upload endpoint only saves the file. It does not build embeddings immediately.

List uploaded documents:

```bash
curl http://127.0.0.1:18755/kb/documents
```

If you want to index the existing repository knowledge base in one shot instead of uploading files one by one:

```bash
curl -X POST http://127.0.0.1:18755/kb/ingest \
  -H 'Content-Type: application/json' \
  -d '{"recreate_collection":true}'
```

`RAG_KNOWLEDGE_BASE_DIR` defaults to `../knowledge-base`, which matches this repository layout.

## 6. Test retrieval and generation

Retrieve only:

```bash
curl -X POST http://127.0.0.1:18755/rag/retrieve \
  -H 'Content-Type: application/json' \
  -d '{"question":"灵山大佛适合什么时候去看？"}'
```

Generate answer with DeepSeek:

```bash
curl -X POST http://127.0.0.1:18755/rag/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"灵山大佛适合什么时候去看？","interest":"历史文化","sessionId":"demo-001","enableHumanReview":false}'
```

`/rag/query` is now orchestrated by LangGraph. The graph includes:

- query rewrite from recent conversation memory
- retrieval and reranking
- context sufficiency judging
- second retrieval when context is weak
- grounded answer generation
- fallback answer generation
- answer quality checking
- citation format validation and auto-completion
- optional human review interrupt through `enableHumanReview`
- SQLite checkpoint persistence by `sessionId`

The runtime files are created under `ai-service/rag/.runtime/`:

- `rag_checkpoints.sqlite` stores LangGraph checkpoints.
- `rag_memory.sqlite` stores recent user/assistant turns for follow-up question rewriting.

## 7. Connect backend-java

The Java backend reads the shared config and resolves:

```bash
RAG_SERVICE_URL=http://127.0.0.1:18755
```

Then `/api/user/guide/chat` will call the RAG service automatically.
The admin upload endpoint `/api/admin/knowledge/documents/upload` only saves files.
Use `/api/admin/knowledge/build` to trigger chunking, embedding, and vector indexing.

## Notes

- If DeepSeek is not configured or unavailable, `/rag/query` falls back to a retrieval-only summary.
- The current implementation uses OpenAI-compatible `/chat/completions`.
- If you prefer a reasoning model later, update only `RAG_LLM_MODEL`.
