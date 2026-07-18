# 景点知识发布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让管理员把已应用到正式景点的资料预览并幂等发布到指定 MaxKB 知识库，并支持重发、过期标记和撤回。

**Architecture:** DigitalHuman 以正式景点和正式详情生成稳定 Markdown，使用本地发布记录追踪 MaxKB 账号、知识库、远端文档、内容摘要和状态。首次发布走现有异步上传任务；重发采用“新文档成功后删除旧文档”的安全切换。为支持撤回和安全切换，先在 MaxKB OpenAPI 增加受 manage 权限保护的文档删除端点，再由 DigitalHuman 代理。

**Tech Stack:** Java 21、Spring Boot、Spring Data JPA、OkHttp、JUnit 5、Mockito、React 19、TypeScript、Ant Design、MaxKB Django OpenAPI

## Global Constraints

- 未匹配或未应用的结构化记录不得发布。
- 发布正文只能读取正式景点和正式详情，不能读取暂存记录正文。
- 不把直播密钥、内部状态或游客行为明细写入知识文档。
- 发布失败必须保留旧文档；资料修改后必须显示待重新发布。
- 同一景点和目标知识库的相同内容必须幂等。
- 不新增第三方依赖。
- 只提交本计划涉及的文件，不纳入现有 `frontend-visitor/src/pages/MapPage*` 工作区改动。

---

### Task 1: 为 MaxKB OpenAPI 增加文档删除能力

**Files:**
- Modify: `/Users/zzs/Desktop/zzs/github/MaxKB/apps/knowledge/open_api/views.py`
- Modify: `/Users/zzs/Desktop/zzs/github/MaxKB/apps/knowledge/open_api/urls.py`
- Modify: `/Users/zzs/Desktop/zzs/github/MaxKB/apps/knowledge/test_open_api_document_import.py`
- Modify: `/Users/zzs/Desktop/zzs/github/MaxKB/docs/openapi/knowledge-document-upload.md`

**Interfaces:**
- Consumes: `authenticate_open_api_key(request)`、`check_knowledge_permission(..., manage=True)`、`DocumentSerializers.Operate.delete()`。
- Produces: `DELETE /openapi/knowledge/v1/workspaces/{workspace_id}/knowledges/{knowledge_id}/documents/{document_id}`。

- [ ] **Step 1: 写失败测试，锁定权限与删除契约**

```python
@patch("knowledge.open_api.views.check_knowledge_permission")
@patch("knowledge.open_api.views.authenticate_open_api_key")
@patch("knowledge.open_api.views.DocumentSerializers.Operate")
def test_document_delete_requires_manage_permission_and_delegates(
    self, operate_cls, authenticate, check_permission
):
    request = APIRequestFactory().delete(
        "/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/doc-1",
        HTTP_AUTHORIZATION="Bearer key",
    )
    authenticate.return_value = SimpleNamespace(user=SimpleNamespace(id="user-1"))
    operate_cls.return_value.delete.return_value = True

    response = KnowledgeOpenAPIDocumentDetailView().delete(
        request, "ws-1", "kb-1", "doc-1"
    )

    check_permission.assert_called_once_with(
        authenticate.return_value, "ws-1", "kb-1", manage=True
    )
    operate_cls.assert_called_once_with(data={
        "workspace_id": "ws-1",
        "knowledge_id": "kb-1",
        "document_id": "doc-1",
    })
    assert response.data["data"] is True
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd /Users/zzs/Desktop/zzs/github/MaxKB && uv run python apps/manage.py test knowledge.test_open_api_document_import.KnowledgeOpenAPIDocumentTest.test_document_delete_requires_manage_permission_and_delegates`

Expected: FAIL，`KnowledgeOpenAPIDocumentDetailView` 尚不存在。

- [ ] **Step 3: 实现最小删除视图与路由**

```python
class KnowledgeOpenAPIDocumentDetailView(APIView):
    def delete(self, request, workspace_id, knowledge_id, document_id):
        identity = authenticate_open_api_key(request)
        check_knowledge_permission(identity, workspace_id, knowledge_id, manage=True)
        operate = DocumentSerializers.Operate(data={
            "workspace_id": workspace_id,
            "knowledge_id": knowledge_id,
            "document_id": document_id,
        })
        operate.is_valid(raise_exception=True)
        return result.success(operate.delete())
```

在 `urls.py` 注册精确路径，并在 OpenAPI 文档中补请求、成功响应、404 与权限说明。

- [ ] **Step 4: 运行 MaxKB OpenAPI 回归**

Run: `cd /Users/zzs/Desktop/zzs/github/MaxKB && uv run python apps/manage.py test knowledge.test_open_api_document_import`

Expected: PASS。

- [ ] **Step 5: 提交 MaxKB 变更**

```bash
git add apps/knowledge/open_api/views.py apps/knowledge/open_api/urls.py apps/knowledge/test_open_api_document_import.py docs/openapi/knowledge-document-upload.md
git commit -m "feat: 为知识文档开放安全删除接口" \
  -m "Constraint: 仅知识库管理权限的 OpenAPI Key 可以删除文档" \
  -m "Rejected: 复用管理端 Token 接口 | DigitalHuman 仅持有 OpenAPI Key" \
  -m "Confidence: high" -m "Scope-risk: moderate" \
  -m "Directive: 删除接口必须持续校验 workspace 与 knowledge 归属" \
  -m "Tested: knowledge.test_open_api_document_import" \
  -m "Not-tested: 尚未部署到远端 MaxKB" \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 2: 在 DigitalHuman 代理远端文档删除

**Files:**
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/MaxKbKnowledgeService.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/impl/MaxKbKnowledgeServiceImpl.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/MaxKbKnowledgeController.java`
- Modify: `backend-java/src/test/java/com/digitalhuman/backend_java/service/MaxKbKnowledgeServiceImplTests.java`
- Modify: `backend-java/src/test/java/com/digitalhuman/backend_java/controller/MaxKbKnowledgeControllerTests.java`

**Interfaces:**
- Consumes: Task 1 的 `DELETE .../documents/{documentId}`。
- Produces: `Object deleteDocument(Long accountId, String knowledgeId, String documentId)` 与管理端同路径代理。

- [ ] **Step 1: 写 service 和 controller 失败测试**

```java
verify(requestFactory).delete(
    "/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/doc-1");
verify(service).deleteDocument(3L, "kb-1", "doc-1");
```

- [ ] **Step 2: 运行定向测试确认失败**

Run: `cd backend-java && mvn -q -Dtest=MaxKbKnowledgeServiceImplTests,MaxKbKnowledgeControllerTests test`

Expected: FAIL，接口与方法不存在。

- [ ] **Step 3: 添加接口、实现和路由**

```java
Object deleteDocument(Long accountId, String knowledgeId, String documentId);

@DeleteMapping("/accounts/{accountId}/knowledges/{knowledgeId}/documents/{documentId}")
public ApiResult<Object> deleteDocument(
        @PathVariable Long accountId,
        @PathVariable String knowledgeId,
        @PathVariable String documentId,
        HttpServletRequest request) {
    requireAdmin(request);
    return ApiResult.success(maxKbKnowledgeService.deleteDocument(accountId, knowledgeId, documentId));
}
```

实现复用现有账号校验、URL 规范化、认证头和 JSON 错误保护，不新增第二套 HTTP 客户端。

- [ ] **Step 4: 运行定向测试**

Run: `cd backend-java && mvn -q -Dtest=MaxKbKnowledgeServiceImplTests,MaxKbKnowledgeControllerTests test`

Expected: PASS。

- [ ] **Step 5: 提交代理能力**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/service/MaxKbKnowledgeService.java backend-java/src/main/java/com/digitalhuman/backend_java/service/impl/MaxKbKnowledgeServiceImpl.java backend-java/src/main/java/com/digitalhuman/backend_java/controller/MaxKbKnowledgeController.java backend-java/src/test/java/com/digitalhuman/backend_java/service/MaxKbKnowledgeServiceImplTests.java backend-java/src/test/java/com/digitalhuman/backend_java/controller/MaxKbKnowledgeControllerTests.java
git commit -m "feat: 代理 MaxKB 知识文档撤回能力" -m "Constraint: 仅管理员可调用文档删除代理" -m "Rejected: 由前端直连 MaxKB | 会暴露 OpenAPI Key" -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: 代理错误不得包含认证头" -m "Tested: MaxKbKnowledgeServiceImplTests；MaxKbKnowledgeControllerTests" -m "Not-tested: 真实 MaxKB 删除在集成任务验证" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 3: 建立发布记录与正式景点 Markdown 渲染器

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/model/ScenicKnowledgePublication.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/ScenicKnowledgePublicationRepository.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/ScenicKnowledgePublicationDto.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicKnowledgeDocumentRenderer.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicKnowledgeDocumentRendererTests.java`

**Interfaces:**
- Produces: `RenderedDocument render(ScenicFacility facility, ScenicFacilityDetail detail)`，其中 `RenderedDocument(String fileName, String markdown, String sha256, int contentVersion)`。
- Produces: repository 查询 `findFirstByFacilityIdAndAccountIdAndKnowledgeIdOrderByVersionDesc(...)`。

- [ ] **Step 1: 写失败测试，锁定正文来源和敏感字段排除**

```java
var rendered = renderer.render(facility, detail);
assertTrue(rendered.markdown().contains("## 文化内涵"));
assertTrue(rendered.markdown().contains(detail.getCulturalConnotation()));
assertFalse(rendered.markdown().contains("camera_stream_key"));
assertFalse(rendered.markdown().contains("tourist_id"));
assertEquals("scenic-facility-12.md", rendered.fileName());
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend-java && mvn -q -Dtest=ScenicKnowledgeDocumentRendererTests test`

Expected: FAIL，渲染器不存在。

- [ ] **Step 3: 实现实体、仓储、DTO 与稳定渲染器**

实体字段严格使用规格中的 account/knowledge/document/logicalKey/hash/version/status/error/publishedBy/publishedAt 时间信息；状态常量限定为 `publishing|published|outdated|failed|withdrawn`。Markdown 只追加非空公开字段，SHA-256 使用 UTF-8 正文计算。

- [ ] **Step 4: 运行渲染测试**

Run: `cd backend-java && mvn -q -Dtest=ScenicKnowledgeDocumentRendererTests test`

Expected: PASS。

- [ ] **Step 5: 提交发布领域基础**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/model/ScenicKnowledgePublication.java backend-java/src/main/java/com/digitalhuman/backend_java/repository/ScenicKnowledgePublicationRepository.java backend-java/src/main/java/com/digitalhuman/backend_java/dto/ScenicKnowledgePublicationDto.java backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicKnowledgeDocumentRenderer.java backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicKnowledgeDocumentRendererTests.java
git commit -m "feat: 建立景点知识发布记录与文档渲染" -m "Constraint: 发布正文只读取正式景点资料" -m "Rejected: 直接序列化实体 | 会混入内部配置字段" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: 新增发布字段必须显式加入白名单" -m "Tested: ScenicKnowledgeDocumentRendererTests" -m "Not-tested: 尚未调用 MaxKB" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 4: 实现预览、发布、安全重发、撤回和过期标记

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicKnowledgePublicationService.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminScenicKnowledgePublicationController.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicKnowledgePublicationServiceTests.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicFacilityContentService.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/AdminScenicFacilityService.java`

**Interfaces:**
- Produces: `preview(Long recordId)`、`publish(Long recordId, PublishRequest request, AuthSession actor)`、`getStatus(Long facilityId)`、`withdraw(Long facilityId, AuthSession actor)`。
- Consumes: Task 3 渲染器与 Task 2 MaxKB 删除代理。

- [ ] **Step 1: 写服务失败测试**

覆盖：未应用返回 409；预览读取 `matchedFacilityId` 对应正式景点；相同 SHA 返回既有发布；新发布先上传并 apply；重发成功后才删旧文档；上传失败保留旧记录；撤回删除远端文档；详情保存和正式景点更新把 `published` 标为 `outdated`。

```java
assertThrows(ResponseStatusException.class, () -> service.preview(pendingRecordId));
verify(maxKbService, never()).uploadDocuments(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
verify(maxKbService).deleteDocument(accountId, knowledgeId, oldDocumentId);
assertEquals("outdated", repository.findById(publicationId).orElseThrow().getStatus());
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend-java && mvn -q -Dtest=ScenicKnowledgePublicationServiceTests test`

Expected: FAIL，发布服务不存在。

- [ ] **Step 3: 实现发布服务与 REST 契约**

```text
GET    /api/admin/scenic-knowledge/records/{recordId}/preview
POST   /api/admin/scenic-knowledge/records/{recordId}/publish
GET    /api/admin/scenic-knowledge/facilities/{facilityId}/status
POST   /api/admin/scenic-knowledge/facilities/{facilityId}/withdraw
```

`PublishRequest` 固定为 `accountId`、`knowledgeId`、`knowledgeName`。发布使用 `scenic:{facilityId}:{knowledgeId}:{sha256}` 作为幂等键；远端任务必须到 `COMPLETED` 后才能切换本地 published 记录。所有错误先经现有 MaxKB 错误清理，再保存到 `lastError`。

- [ ] **Step 4: 在正式资料保存路径标记过期**

在 `ScenicFacilityContentService.saveContent` 与 `AdminScenicFacilityService.updateFacility/deleteFacility` 成功持久化后调用 `publicationService.markOutdated(facilityId)`；避免在事务提交前发远端请求，标记方法只改本地状态。

- [ ] **Step 5: 运行服务与现有景点回归**

Run: `cd backend-java && mvn -q -Dtest=ScenicKnowledgePublicationServiceTests,ScenicFacilityContentServiceTests,ScenicStructuredApplicationServiceTests test`

Expected: PASS。

- [ ] **Step 6: 提交发布编排**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicKnowledgePublicationService.java backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminScenicKnowledgePublicationController.java backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicKnowledgePublicationServiceTests.java backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicFacilityContentService.java backend-java/src/main/java/com/digitalhuman/backend_java/service/AdminScenicFacilityService.java
git commit -m "feat: 支持审核发布与撤回正式景点知识" -m "Constraint: 新文档完成前必须保留旧知识版本" -m "Rejected: 保存景点后自动发布 | 未经管理员审核" -m "Confidence: high" -m "Scope-risk: broad" -m "Directive: 远端任务未完成不得切换 published 状态" -m "Tested: 发布服务与景点内容定向测试" -m "Not-tested: 真实 MaxKB 集成在最终任务验证" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 5: 在景点资料页接入发布工作台

**Files:**
- Modify: `frontend-admin/src/api/scenicStructured.ts`
- Create: `frontend-admin/src/pages/scenic/ScenicKnowledgePublishDrawer.tsx`
- Modify: `frontend-admin/src/pages/scenic/ScenicStructuredPage.tsx`
- Modify: `frontend-admin/src/pages/scenic/ScenicStructuredPage.test.mjs`
- Create: `frontend-admin/src/pages/scenic/ScenicKnowledgePublishDrawer.test.mjs`

**Interfaces:**
- Consumes: Task 4 REST 契约与现有 `listMaxKbAccounts`、`listKnowledges` API。
- Produces: 已应用记录的发布状态、预览、发布、重试和撤回 UI。

- [ ] **Step 1: 扩展契约测试并确认失败**

```js
assert.match(apiSource, /previewScenicKnowledgePublication/)
assert.match(apiSource, /publishScenicKnowledge/)
assert.match(pageSource, /applyStatus === 'applied'/)
assert.match(pageSource, /发布到知识库/)
assert.match(drawerSource, /撤回知识/)
```

Run: `cd frontend-admin && node src/pages/scenic/ScenicStructuredPage.test.mjs && node src/pages/scenic/ScenicKnowledgePublishDrawer.test.mjs`

Expected: FAIL，API 和抽屉不存在。

- [ ] **Step 2: 实现 API 类型与发布抽屉**

API 类型必须包含 `status/accountId/knowledgeId/knowledgeName/documentId/contentHash/version/publishedAt/lastError/markdown`。抽屉先加载账号，再按账号加载知识库；确认按钮先展示 Markdown 预览，提交期间禁用重复点击。

- [ ] **Step 3: 在表格中接入状态和权限门禁**

未应用记录只显示“请先应用到正式景点”；已应用记录展示状态 Tag 和发布操作。Observer 通过现有角色状态只读，不渲染发布、重试、撤回确认动作。

- [ ] **Step 4: 运行前端验证**

Run: `cd frontend-admin && node src/api/knowledgeOpenApi.test.mjs && node src/pages/scenic/ScenicStructuredPage.test.mjs && node src/pages/scenic/ScenicKnowledgePublishDrawer.test.mjs && npm run lint && npm run build`

Expected: 全部 PASS，Vite 生产构建成功。

- [ ] **Step 5: 提交前端发布工作台**

```bash
git add frontend-admin/src/api/scenicStructured.ts frontend-admin/src/pages/scenic/ScenicKnowledgePublishDrawer.tsx frontend-admin/src/pages/scenic/ScenicStructuredPage.tsx frontend-admin/src/pages/scenic/ScenicStructuredPage.test.mjs frontend-admin/src/pages/scenic/ScenicKnowledgePublishDrawer.test.mjs
git commit -m "feat: 在景点资料页提供知识发布工作台" -m "Constraint: 仅已应用记录允许发布" -m "Rejected: 在暂存记录上直接发布 | 会绕过正式主数据审核" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: 发布预览必须来自后端正式景点快照" -m "Tested: 页面契约测试；ESLint；Vite build" -m "Not-tested: 浏览器真实 MaxKB 发布在集成验证执行" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 6: 完整发布链路验证

**Files:**
- Create: `docs/verification/2026-07-18-scenic-knowledge-publishing.md`

- [ ] **Step 1: 运行后端完整测试**

Run: `cd backend-java && mvn test`

Expected: BUILD SUCCESS。

- [ ] **Step 2: 运行管理端完整检查**

Run: `cd frontend-admin && npm run lint && npm run build`

Expected: ESLint 0 error，Vite build 成功。

- [ ] **Step 3: 真实 MaxKB 冒烟验证**

在管理员页面选择已应用景点：预览正文不含内部字段；首次发布后可被 hit-test 命中；修改正式详情后状态为 outdated；重发成功后旧文档删除；撤回后 hit-test 不再返回该文档。把账号、知识库、文档 ID、时间和结果记录到验证文档，认证密钥不得写入。

- [ ] **Step 4: 提交验证记录**

```bash
git add docs/verification/2026-07-18-scenic-knowledge-publishing.md
git commit -m "test: 记录景点知识发布全链路验证" -m "Constraint: 验证记录不得包含 MaxKB OpenAPI Key" -m "Rejected: 仅以 mock 测试代替真实发布 | 无法证明远端索引切换" -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: MaxKB 升级后重新执行发布与撤回冒烟" -m "Tested: Maven；管理端 lint/build；真实 MaxKB 发布重发撤回" -m "Not-tested: 无" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```
