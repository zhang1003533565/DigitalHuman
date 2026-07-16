# MaxKB Source-Faithful Document Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a MaxKB-source-faithful two-step document upload workbench in DigitalHuman, backed by a safe MaxKB OpenAPI model-list endpoint and the existing asynchronous preview/apply workflow.

**Architecture:** MaxKB exposes a read-only workspace model list through the same knowledge OpenAPI key and permission boundary used by document upload. DigitalHuman proxies that endpoint through the saved account configuration, while a focused React upload workbench owns file selection, split settings, model selection, task polling, preview, cancellation, and final apply. `KnowledgeOpenApiPage` only switches views and refreshes documents after import.

**Tech Stack:** Django REST Framework, Django `SimpleTestCase`, Spring Boot, OkHttp, JUnit 5, Mockito, React 19, TypeScript 6, Ant Design 6, CSS.

## Global Constraints

- The upload interaction must follow `MaxKB/ui/src/views/document/UploadDocument.vue`, `UploadComponent.vue`, and `SetRules.vue`.
- The OpenAPI model endpoint may return model display metadata only; it must never expose credentials or model parameter forms.
- Model UUIDs must come from MaxKB and must not be mixed with DigitalHuman model settings.
- Only ordinary document upload is in scope; QA and table-specific internal MaxKB upload endpoints remain unavailable.
- No new frontend dependencies.
- Preserve existing account URL normalization for copied `/openapi/knowledge/v1/workspaces/{workspace_id}` URLs.
- Keep unrelated working-tree changes intact.

---

### Task 1: Expose safe MaxKB workspace models through Knowledge OpenAPI

**Files:**
- Modify: `/Users/zzs/Desktop/zzs/github/MaxKB/apps/knowledge/open_api/views.py`
- Modify: `/Users/zzs/Desktop/zzs/github/MaxKB/apps/knowledge/open_api/urls.py`
- Modify: `/Users/zzs/Desktop/zzs/github/MaxKB/apps/knowledge/test_open_api_document_import.py`
- Modify: `/Users/zzs/Desktop/zzs/github/MaxKB/docs/openapi/knowledge-document-upload.md`

**Interfaces:**
- Consumes: `authenticate_open_api_key(request)`, `check_workspace(identity, workspace_id)`, and `ModelSerializer.Query(...).model_list(workspace_id)`.
- Produces: `GET /openapi/knowledge/v1/workspaces/{workspace_id}/models?model_type=LLM|IMAGE` returning `[{id,name,model_name,model_type,provider,scope}]` inside MaxKB's standard success envelope.

- [ ] **Step 1: Write failing endpoint tests**

Append tests to `KnowledgeOpenAPIDocumentTest` that patch authentication and the existing model serializer. Assert workspace authorization, filtering, safe field projection, scope tagging, and invalid type rejection:

```python
    @patch("knowledge.open_api.views.check_workspace")
    @patch("knowledge.open_api.views.authenticate_open_api_key")
    @patch("knowledge.open_api.views.ModelSerializer.Query.model_list")
    def test_model_list_returns_safe_workspace_and_shared_models(
        self, model_list, authenticate, check_workspace
    ):
        from knowledge.open_api.views import KnowledgeOpenAPIModelView

        authenticate.return_value = SimpleNamespace(user=SimpleNamespace(id="user-1"))
        model_list.return_value = {
            "model": [{
                "id": "llm-1", "name": "通义千问", "model_name": "qwen-plus",
                "model_type": "LLM", "provider": "Qwen", "credential": {"api_key": "secret"}
            }],
            "shared_model": [{
                "id": "llm-2", "name": "共享模型", "model_name": "shared-chat",
                "model_type": "LLM", "provider": "OpenAI", "model_params_form": ["secret"]
            }],
        }
        from rest_framework.request import Request
        request = Request(RequestFactory().get(
            "/openapi/knowledge/v1/workspaces/default/models", {"model_type": "LLM"}
        ))

        response = KnowledgeOpenAPIModelView().get(request, workspace_id="default")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"][0]["scope"], "workspace")
        self.assertEqual(response.data["data"][1]["scope"], "shared")
        self.assertNotIn("credential", response.data["data"][0])
        self.assertNotIn("model_params_form", response.data["data"][1])
        check_workspace.assert_called_once_with(authenticate.return_value, "default")
        model_list.assert_called_once()

    @patch("knowledge.open_api.views.authenticate_open_api_key")
    def test_model_list_rejects_unsupported_model_type(self, authenticate):
        from knowledge.open_api.views import KnowledgeOpenAPIModelView

        authenticate.return_value = SimpleNamespace(user=SimpleNamespace(id="user-1"))
        from rest_framework.request import Request
        request = Request(RequestFactory().get(
            "/openapi/knowledge/v1/workspaces/default/models", {"model_type": "EMBEDDING"}
        ))

        with self.assertRaises(AppApiException) as error:
            KnowledgeOpenAPIModelView().get(request, workspace_id="default")

        self.assertEqual(error.exception.code, 400)
```

- [ ] **Step 2: Run the focused MaxKB test and confirm RED**

Run:

```bash
cd /Users/zzs/Desktop/zzs/github/MaxKB
python main.py test knowledge.test_open_api_document_import.KnowledgeOpenAPIDocumentTest --keepdb
```

Expected: FAIL because `KnowledgeOpenAPIModelView` does not exist.

- [ ] **Step 3: Implement the safe projection and endpoint**

Import `ModelSerializer`, define allowed types, project only the six public fields, and flatten normal/shared models:

```python
from models_provider.serializers.model_serializer import ModelSerializer

OPEN_API_MODEL_TYPES = {"LLM", "IMAGE"}
OPEN_API_MODEL_FIELDS = ("id", "name", "model_name", "model_type", "provider")


def _open_api_model(model, scope):
    return {
        **{field: model.get(field) for field in OPEN_API_MODEL_FIELDS},
        "scope": scope,
    }


class KnowledgeOpenAPIModelView(APIView):
    def get(self, request: Request, workspace_id: str):
        identity = authenticate_open_api_key(request)
        check_workspace(identity, workspace_id)
        model_type = (request.query_params.get("model_type") or "").upper()
        if model_type not in OPEN_API_MODEL_TYPES:
            raise AppApiException(400, _("model_type must be LLM or IMAGE"))
        payload = ModelSerializer.Query(
            data={"user_id": str(identity.user.id), "model_type": model_type}
        ).model_list(workspace_id=workspace_id, with_valid=True)
        models = [
            *[_open_api_model(model, "workspace") for model in payload.get("model", [])],
            *[_open_api_model(model, "shared") for model in payload.get("shared_model", [])],
        ]
        return result.success(models)
```

Register before the knowledge routes:

```python
path(
    "workspaces/<str:workspace_id>/models",
    views.KnowledgeOpenAPIModelView.as_view(),
),
```

Add the endpoint to `KnowledgeOpenAPIDocsView` with `model_type` enum metadata, and add a Markdown section with request/response examples to `knowledge-document-upload.md`.

- [ ] **Step 4: Run MaxKB endpoint and upload regression tests**

Run:

```bash
cd /Users/zzs/Desktop/zzs/github/MaxKB
python main.py test knowledge.test_open_api_document_import --keepdb
```

Expected: all tests PASS with zero failures.

- [ ] **Step 5: Commit the MaxKB endpoint independently**

```bash
cd /Users/zzs/Desktop/zzs/github/MaxKB
git add apps/knowledge/open_api/views.py apps/knowledge/open_api/urls.py apps/knowledge/test_open_api_document_import.py docs/openapi/knowledge-document-upload.md
git commit -m "feat: 为文档上传开放可选模型列表" -m "Constraint: OpenAPI 只返回模型展示字段" -m "Rejected: 复用管理端 Token 接口 | OpenAPI Key 无法稳定访问" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: 不得在响应中加入 credential 或 model_params_form" -m "Tested: knowledge.test_open_api_document_import" -m "Not-tested: 尚未部署到远端 MaxKB" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 2: Proxy MaxKB models through DigitalHuman backend

**Files:**
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/MaxKbKnowledgeService.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/impl/MaxKbKnowledgeServiceImpl.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/MaxKbKnowledgeController.java`
- Modify: `backend-java/src/test/java/com/digitalhuman/backend_java/service/MaxKbKnowledgeServiceImplTests.java`

**Interfaces:**
- Consumes: MaxKB endpoint from Task 1.
- Produces: `Object listModels(Long accountId, String modelType)` and `GET /api/admin/knowledge/maxkb/accounts/{accountId}/models?model_type=LLM|IMAGE`.

- [ ] **Step 1: Write the failing path and query forwarding test**

Add to `MaxKbKnowledgeServiceImplTests`:

```java
    @Test
    void listModelsShouldUseNormalizedWorkspacePathAndForwardModelType() {
        service.listModels(1L, "LLM");

        assertEquals("GET", capturedRequest.method());
        assertEquals(
                "/openapi/knowledge/v1/workspaces/ws-1/models",
                capturedRequest.url().encodedPath()
        );
        assertEquals("LLM", capturedRequest.url().queryParameter("model_type"));
        assertEquals("Bearer mkb_secret_key", capturedRequest.header("Authorization"));
    }
```

- [ ] **Step 2: Run the focused backend test and confirm RED**

Run:

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman/backend-java
./mvnw -Dtest=MaxKbKnowledgeServiceImplTests#listModelsShouldUseNormalizedWorkspacePathAndForwardModelType test
```

Expected: compilation FAIL because `listModels` is undefined.

- [ ] **Step 3: Add service and controller contracts**

Add to `MaxKbKnowledgeService`:

```java
Object listModels(Long accountId, String modelType);
```

Implement in `MaxKbKnowledgeServiceImpl` through the existing `getObject` path so copied workspace URLs keep using the current normalization logic:

```java
@Override
public Object listModels(Long accountId, String modelType) {
    MaxKbAccount account = getAccount(accountId, true);
    String normalizedType = trim(modelType).toUpperCase();
    if (!List.of("LLM", "IMAGE").contains(normalizedType)) {
        throw status(HttpStatus.BAD_REQUEST, "模型类型只能是 LLM 或 IMAGE");
    }
    return getObject(
            account,
            "/workspaces/" + account.getWorkspaceId() + "/models",
            Map.of("model_type", normalizedType)
    );
}
```

Add to `MaxKbKnowledgeController` before knowledge routes:

```java
@GetMapping("/accounts/{accountId}/models")
public ApiResult<Object> listModels(
        @PathVariable Long accountId,
        @RequestParam(name = "model_type") String modelType,
        HttpServletRequest request
) {
    requireAdmin(request);
    return ApiResult.success(maxKbKnowledgeService.listModels(accountId, modelType));
}
```

- [ ] **Step 4: Run the complete MaxKB service test class**

Run:

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman/backend-java
./mvnw -Dtest=MaxKbKnowledgeServiceImplTests test
```

Expected: all tests PASS, including copied URL normalization and HTML-response diagnostics.

- [ ] **Step 5: Commit the DigitalHuman backend proxy**

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman
git add backend-java/src/main/java/com/digitalhuman/backend_java/service/MaxKbKnowledgeService.java backend-java/src/main/java/com/digitalhuman/backend_java/service/impl/MaxKbKnowledgeServiceImpl.java backend-java/src/main/java/com/digitalhuman/backend_java/controller/MaxKbKnowledgeController.java backend-java/src/test/java/com/digitalhuman/backend_java/service/MaxKbKnowledgeServiceImplTests.java
git commit -m "feat: 代理 MaxKB 上传模型列表" -m "Constraint: 浏览器不得接触 MaxKB API Key" -m "Rejected: 前端直连 MaxKB | 会暴露凭证并绕过账户规范化" -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: 模型列表继续走 getObject 的统一 JSON 诊断" -m "Tested: MaxKbKnowledgeServiceImplTests" -m "Not-tested: 远端 MaxKB 部署验证" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 3: Add typed frontend model and upload API contracts

**Files:**
- Modify: `frontend-admin/src/api/knowledgeOpenApi.ts`
- Modify: `frontend-admin/src/api/knowledgeOpenApi.test.mjs`

**Interfaces:**
- Consumes: DigitalHuman backend endpoint from Task 2.
- Produces: `MaxKbUploadModel`, `MaxKbUploadModelType`, and `getKnowledgeModels(accountId, modelType)`.

- [ ] **Step 1: Extend the static API contract test**

Add assertions:

```javascript
test('MaxKB upload model list uses the account proxy', () => {
  assert.match(source, /export type MaxKbUploadModelType = 'LLM' \| 'IMAGE'/)
  assert.match(source, /export type MaxKbUploadModel/)
  assert.match(source, /export async function getKnowledgeModels/)
  assert.match(source, /accounts\/\$\{accountId\}\/models/)
  assert.match(source, /model_type: modelType/)
})
```

- [ ] **Step 2: Run the API contract test and confirm RED**

Run:

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin
node src/api/knowledgeOpenApi.test.mjs
```

Expected: FAIL because the model types and wrapper are absent.

- [ ] **Step 3: Implement the typed model wrapper**

Add:

```typescript
export type MaxKbUploadModelType = 'LLM' | 'IMAGE'

export type MaxKbUploadModel = {
  id: string
  name: string
  model_name?: string
  model_type: MaxKbUploadModelType
  provider?: string
  scope?: 'workspace' | 'shared'
}

export async function getKnowledgeModels(
  accountId: number,
  modelType: MaxKbUploadModelType,
) {
  const response = await axios.get<ApiResult<MaxKbResponse<MaxKbUploadModel[]>>>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/models`,
    { params: { model_type: modelType } },
  )
  return extractRecords(unwrapApiResult(response.data)) as MaxKbUploadModel[]
}
```

Keep existing asynchronous upload wrappers unchanged.

- [ ] **Step 4: Run the API test and TypeScript production build**

Run:

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin
node src/api/knowledgeOpenApi.test.mjs
npm run build
```

Expected: API tests PASS and build exits 0.

- [ ] **Step 5: Commit the frontend API contract**

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman
git add frontend-admin/src/api/knowledgeOpenApi.ts frontend-admin/src/api/knowledgeOpenApi.test.mjs
git commit -m "feat: 提供 MaxKB 上传模型选择接口" -m "Constraint: 前端模型类型仅允许 LLM 与 IMAGE" -m "Rejected: 复用系统模型目录 | 模型 ID 不属于 MaxKB" -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: 上传模型类型必须与 MaxKB OpenAPI 保持一致" -m "Tested: knowledgeOpenApi.test.mjs；Vite build" -m "Not-tested: 浏览器交互在后续任务验证" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 4: Build the MaxKB-style two-step upload workbench

**Files:**
- Create: `frontend-admin/src/pages/knowledge-openapi/MaxKbDocumentUploadWorkbench.tsx`
- Create: `frontend-admin/src/pages/knowledge-openapi/maxkb-document-upload-workbench.test.mjs`

**Interfaces:**
- Consumes: `getKnowledgeModels`, all existing upload-task wrappers, `extractRecords`, and `MaxKbRecord`.
- Produces: `MaxKbDocumentUploadWorkbench({accountId,knowledgeId,knowledgeName,onCancel,onImported})`.

- [ ] **Step 1: Write the failing source-contract test**

Create the test with explicit source-level requirements:

```javascript
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./MaxKbDocumentUploadWorkbench.tsx', import.meta.url), 'utf8')

test('workbench follows MaxKB two-step upload flow', () => {
  assert.match(source, /Upload\.Dragger/)
  assert.match(source, /智能分段/)
  assert.match(source, /高级分段/)
  assert.match(source, /模型分段/)
  assert.match(source, /视觉模型分段/)
  assert.match(source, /getKnowledgeModels\(accountId, 'LLM'\)/)
  assert.match(source, /getKnowledgeModels\(accountId, 'IMAGE'\)/)
  assert.match(source, /uploadKnowledgeDocuments/)
  assert.match(source, /getKnowledgeUploadTask/)
  assert.match(source, /previewKnowledgeUploadTask/)
  assert.match(source, /applyKnowledgeUploadTask/)
  assert.match(source, /cancelKnowledgeUploadTask/)
  assert.match(source, /确认导入/)
})

test('workbench validates MaxKB ordinary document limits', () => {
  assert.match(source, /MAX_FILE_COUNT = 50/)
  assert.match(source, /MAX_FILE_SIZE = 100 \* 1024 \* 1024/)
  assert.match(source, /SUPPORTED_EXTENSIONS/)
  assert.match(source, /文件不能为空/)
})
```

- [ ] **Step 2: Run the component contract test and confirm RED**

Run:

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin
node src/pages/knowledge-openapi/maxkb-document-upload-workbench.test.mjs
```

Expected: FAIL with `ENOENT` because the component does not exist.

- [ ] **Step 3: Implement component state, file validation, and step one**

Define focused local types and constants:

```typescript
type UploadStep = 'files' | 'rules' | 'success'
type SplitMode = 'smart' | 'advanced' | 'llm_text' | 'llm_vision'

type Props = {
  accountId: number
  knowledgeId: string
  knowledgeName: string
  onCancel: () => void
  onImported: () => void
}

const MAX_FILE_COUNT = 50
const MAX_FILE_SIZE = 100 * 1024 * 1024
const SUPPORTED_EXTENSIONS = new Set([
  'txt', 'md', 'log', 'docx', 'pdf', 'html', 'zip', 'xlsx', 'xls', 'csv',
])
```

Use `Upload.Dragger` with `beforeUpload={() => false}`, `multiple`, and `showUploadList={false}`. Show the ordinary-document “选择文件” action; do not show MaxKB's folder action because directory upload is not part of the OpenAPI contract. Reject unsupported, empty, oversized, duplicate, or over-limit files with the exact filename in the message. Render accepted files in a responsive two-column list with file icon, size, and icon-only delete button.

Render the MaxKB-style header and footer. `下一步` is disabled until at least one file exists; `取消` clears local state through unmounting.

- [ ] **Step 4: Implement rules, model groups, task polling, preview, and apply**

Load model lists when entering rules and retry independently:

```typescript
const [llmModels, imageModels] = await Promise.all([
  getKnowledgeModels(accountId, 'LLM'),
  getKnowledgeModels(accountId, 'IMAGE'),
])
```

Build grouped Ant Design options:

```typescript
function groupModelOptions(models: MaxKbUploadModel[]) {
  const groups = models.reduce<Record<string, MaxKbUploadModel[]>>((result, model) => {
    const provider = model.provider || '其他'
    result[provider] = [...(result[provider] || []), model]
    return result
  }, {})
  return Object.entries(groups).map(([label, options]) => ({
      label,
      options: options.map((model) => ({
        value: model.id,
        label: `${model.name}${model.model_name ? ` · ${model.model_name}` : ''}`,
      })),
    }))
}
```

Map split modes to upload payloads exactly:

```typescript
const payload = {
  files,
  autoApply: false,
  ...(mode === 'advanced' ? { limit, patterns, withFilter } : {}),
  ...(mode === 'llm_text' ? {
    splitStrategy: 'llm_text', modelId: llmModelId, qualityOptimize,
  } : {}),
  ...(mode === 'llm_vision' ? {
    splitStrategy: 'llm_vision', visionModelId, llmModelId, qualityOptimize,
  } : {}),
}
```

After `uploadKnowledgeDocuments`, retain `task_id`; poll `getKnowledgeUploadTask` every 1000 ms while status is `QUEUED`, `PROCESSING`, or `APPLYING`. When status becomes `PREVIEW_READY`, call `previewKnowledgeUploadTask` and render document/paragraph blocks in the right pane. Stop polling on `PREVIEW_READY`, `COMPLETED`, `FAILED`, or `CANCELLED`, and clear the timer on unmount, account/knowledge change, and cancellation.

Render progress, current stage, processed/total/remaining counts, retry, and cancel. Final `确认导入` calls `applyKnowledgeUploadTask`, enters success state, and invokes `onImported` after the success view action.

Place task history in an Ant Design `Collapse` below current preview. It uses `listKnowledgeUploadTasks` only when expanded and retains existing delete/recovery actions without taking over the main workflow.

- [ ] **Step 5: Run component contract and production build**

Run:

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin
node src/pages/knowledge-openapi/maxkb-document-upload-workbench.test.mjs
npm run build
```

Expected: tests PASS and build exits 0 without TypeScript errors.

- [ ] **Step 6: Commit the isolated upload workbench**

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman
git add frontend-admin/src/pages/knowledge-openapi/MaxKbDocumentUploadWorkbench.tsx frontend-admin/src/pages/knowledge-openapi/maxkb-document-upload-workbench.test.mjs
git commit -m "feat: 构建 MaxKB 同款文档上传工作台" -m "Constraint: 普通文档必须使用两步预览后入库" -m "Rejected: 保留单抽屉表单 | 与 MaxKB 源码交互不一致" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: 新分段策略必须先扩展 MaxKB OpenAPI 契约" -m "Tested: 工作台 Node 测试；Vite build" -m "Not-tested: 页面集成与视觉验证在下一任务完成" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 5: Integrate the workbench and match MaxKB layout responsively

**Files:**
- Modify: `frontend-admin/src/pages/KnowledgeOpenApiPage.tsx`
- Modify: `frontend-admin/src/pages/knowledge-openapi-upload.test.mjs`
- Modify: `frontend-admin/src/App.css`
- Modify: `frontend-admin/src/admin-cockpit.css`

**Interfaces:**
- Consumes: `MaxKbDocumentUploadWorkbench` from Task 4.
- Produces: document-page upload entry that opens a main-content workbench and refreshes documents after import.

- [ ] **Step 1: Rewrite the existing upload page contract test for the new boundary**

Replace drawer-oriented assertions with:

```javascript
test('knowledge page delegates upload to the MaxKB-style workbench', () => {
  assert.match(page, /MaxKbDocumentUploadWorkbench/)
  assert.match(page, /openUploadWorkbench/)
  assert.match(page, /view === 'upload'/)
  assert.doesNotMatch(page, /title=\{`上传文档到/)
  assert.doesNotMatch(page, /模型 ID 请填写 MaxKB 模型管理中的模型 ID/)
  assert.doesNotMatch(page, /<Input[\s\S]*placeholder="填写 MaxKB LLM 模型 ID"/)
})
```

- [ ] **Step 2: Run the page contract test and confirm RED**

Run:

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin
node src/pages/knowledge-openapi-upload.test.mjs
```

Expected: FAIL because the page still owns the drawer and manual model inputs.

- [ ] **Step 3: Replace drawer state with a dedicated view**

Import the workbench and extend the local view union with `upload`. Replace `openUploadDrawer` with:

```typescript
function openUploadWorkbench() {
  if (!selectedAccountId || !selectedKnowledgeId) {
    message.warning('请先选择一个 MaxKB 连接和知识库')
    return
  }
  setView('upload')
}
```

Render inside `<main className="mkb-knowledge-main">`:

```tsx
{view === 'upload' && selectedAccountId && selectedKnowledgeId ? (
  <MaxKbDocumentUploadWorkbench
    accountId={selectedAccountId}
    knowledgeId={selectedKnowledgeId}
    knowledgeName={selectedKnowledge?.nameText ?? '知识库'}
    onCancel={() => setView('documents')}
    onImported={() => {
      void loadDocuments(selectedKnowledgeId)
      setView('documents')
    }}
  />
) : null}
```

Delete the former upload drawer JSX, manual UUID inputs, duplicate task columns, polling effect, and upload-only state/functions now owned by the component. Preserve paragraph editing and connection drawer behavior.

- [ ] **Step 4: Add stable desktop, mobile, light, and dark styles**

Add `mkb-upload-*` classes to `App.css` with these layout invariants:

```css
.mkb-upload-workbench { height: 100%; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
.mkb-upload-rules { min-height: 0; display: grid; grid-template-columns: minmax(320px, 5fr) minmax(440px, 7fr); }
.mkb-upload-rule-list, .mkb-upload-preview { min-width: 0; overflow: auto; padding: 24px; }
.mkb-upload-file-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.mkb-upload-footer { min-height: 64px; display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 12px 24px; border-top: 1px solid var(--cockpit-line); }
```

At the existing mobile breakpoint, switch `.mkb-upload-rules` and `.mkb-upload-file-grid` to one column and allow the page body to scroll. Add only color overrides needed for dark mode in `admin-cockpit.css`; reuse existing variables instead of introducing a separate palette.

- [ ] **Step 5: Run all frontend checks**

Run:

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin
node src/api/knowledgeOpenApi.test.mjs
node src/pages/knowledge-openapi-upload.test.mjs
node src/pages/knowledge-openapi/maxkb-document-upload-workbench.test.mjs
npm run lint
npm run build
```

Expected: all Node tests PASS, ESLint exits 0, and Vite production build exits 0.

- [ ] **Step 6: Perform browser visual verification**

Start the frontend on an unused port:

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman/frontend-admin
npm run dev -- --host 127.0.0.1 --port 4175
```

Using the in-app browser, verify at `1440x900` and `390x844`:

- Step one shows a large drag area and file cards without overflow.
- Step two shows four strategy cards, grouped model selects, progress, and preview.
- Desktop is two-column; mobile is one-column.
- Footer buttons remain reachable and do not overlap content.
- Both admin light and dark themes remain legible.

Capture screenshots for both viewports and inspect them before stopping the server.

- [ ] **Step 7: Run final backend and MaxKB regressions**

Run:

```bash
cd /Users/zzs/Desktop/zzs/github/MaxKB
python main.py test knowledge.test_open_api_document_import --keepdb

cd /Users/zzs/Desktop/zzs/github/DigitalHuman/backend-java
./mvnw -Dtest=MaxKbKnowledgeServiceImplTests test
```

Expected: both suites PASS with zero failures.

- [ ] **Step 8: Commit integration and responsive styling**

```bash
cd /Users/zzs/Desktop/zzs/github/DigitalHuman
git add frontend-admin/src/pages/KnowledgeOpenApiPage.tsx frontend-admin/src/pages/knowledge-openapi-upload.test.mjs frontend-admin/src/App.css frontend-admin/src/admin-cockpit.css
git commit -m "feat: 接入 MaxKB 两步文档上传流程" -m "Constraint: 桌面与移动端均不得出现内容重叠" -m "Rejected: 在主页面继续维护上传任务状态 | 文件职责过重" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: 上传流程状态继续由独立工作台拥有" -m "Tested: 前端 Node 测试；ESLint；Vite build；桌面与移动截图" -m "Not-tested: 远端 MaxKB 真实文件导入取决于部署" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

## Completion Evidence

The work is complete only when all of the following are true:

- MaxKB model OpenAPI tests pass and the response contains no credentials.
- DigitalHuman backend tests prove normalized model-list forwarding and existing upload behavior.
- Frontend contract tests, lint, and production build pass.
- Browser screenshots confirm desktop/mobile two-step layout with no overlap.
- A real deployed MaxKB containing the new model and upload-task routes returns JSON rather than HTML.
