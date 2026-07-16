package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.MaxKbKnowledgeDto;
import com.digitalhuman.backend_java.model.MaxKbAccount;
import com.digitalhuman.backend_java.repository.MaxKbAccountRepository;
import com.digitalhuman.backend_java.service.impl.MaxKbKnowledgeServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import okhttp3.Call;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okio.Buffer;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MaxKbKnowledgeServiceImplTests {

    private MaxKbAccountRepository repository;
    private MaxKbKnowledgeServiceImpl service;
    private Request capturedRequest;
    private MaxKbAccount capturedSavedAccount;
    private Call call;

    @BeforeEach
    void setUp() throws Exception {
        MaxKbAccount account = new MaxKbAccount();
        account.setId(1L);
        account.setAccountName("景区知识库");
        account.setBaseUrl("http://maxkb.test");
        account.setApiKey("mkb_secret_key");
        account.setWorkspaceId("ws-1");
        account.setStatus(1);

        repository = mock(MaxKbAccountRepository.class);
        when(repository.findById(1L)).thenReturn(Optional.of(account));
        when(repository.save(any(MaxKbAccount.class))).thenAnswer(invocation -> {
            capturedSavedAccount = invocation.getArgument(0);
            return capturedSavedAccount;
        });
        service = new MaxKbKnowledgeServiceImpl(repository, new ObjectMapper(), 5);
        OkHttpClient httpClient = mock(OkHttpClient.class);
        call = mock(Call.class);
        when(httpClient.newCall(org.mockito.ArgumentMatchers.any(Request.class))).thenAnswer(invocation -> {
            capturedRequest = invocation.getArgument(0);
            return call;
        });
        when(call.execute()).thenAnswer(invocation -> successfulResponse());
        ReflectionTestUtils.setField(service, "httpClient", httpClient);
    }

    @Test
    void listDocumentsShouldForwardBearerKeyAndDefaultTaskType() {
        Object response = service.listDocuments(1L, "kb-1", Map.of("page", "1"));

        assertInstanceOf(Map.class, response);
        assertEquals("Bearer mkb_secret_key", capturedRequest.header("Authorization"));
        assertTrue(capturedRequest.url().query().contains("page=1"));
        assertTrue(capturedRequest.url().query().contains("task_type=1"));
    }

    @Test
    void copiedOpenApiWorkspaceUrlShouldBeAcceptedAsAccountAddress() {
        MaxKbKnowledgeDto.AccountCreateRequest request = new MaxKbKnowledgeDto.AccountCreateRequest();
        request.setAccountName("复制地址");
        request.setBaseUrl("http://116.62.22.253:8080/openapi/knowledge/v1/workspaces/default");
        request.setApiKey("mkb_secret_key");
        request.setWorkspaceId("default");
        request.setEnvironment("local");
        request.setStatus(1);

        service.createAccount(request);

        assertEquals("http://116.62.22.253:8080", capturedSavedAccount.getBaseUrl());
        assertEquals("default", capturedSavedAccount.getWorkspaceId());
    }

    @Test
    void copiedOpenApiWorkspaceUrlShouldNotDuplicateOpenApiPrefix() {
        MaxKbAccount copiedUrlAccount = new MaxKbAccount();
        copiedUrlAccount.setId(2L);
        copiedUrlAccount.setAccountName("复制地址");
        copiedUrlAccount.setBaseUrl("http://116.62.22.253:8080/openapi/knowledge/v1/workspaces/default");
        copiedUrlAccount.setApiKey("mkb_secret_key");
        copiedUrlAccount.setWorkspaceId("default");
        copiedUrlAccount.setStatus(1);
        when(repository.findById(2L)).thenReturn(Optional.of(copiedUrlAccount));

        service.listKnowledges(2L, Map.of("page", "1"));

        assertEquals("116.62.22.253", capturedRequest.url().host());
        assertEquals(8080, capturedRequest.url().port());
        assertEquals("/openapi/knowledge/v1/workspaces/default/knowledges", capturedRequest.url().encodedPath());
    }

    @Test
    void listModelsShouldUseNormalizedWorkspacePathAndForwardModelType() {
        service.listModels(1L, "LLM");

        assertEquals("GET", capturedRequest.method());
        assertEquals("/openapi/knowledge/v1/workspaces/ws-1/models", capturedRequest.url().encodedPath());
        assertEquals("LLM", capturedRequest.url().queryParameter("model_type"));
        assertEquals("Bearer mkb_secret_key", capturedRequest.header("Authorization"));
    }

    @Test
    void uploadDocumentsShouldForwardAsyncImportOptionsAndIdempotencyKey() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "manual.pdf",
                "application/pdf",
                "PDF".getBytes(StandardCharsets.UTF_8)
        );

        service.uploadDocuments(
                1L,
                "kb-1",
                java.util.List.of((MultipartFile) file),
                java.util.List.of("existing-file-id"),
                2048,
                java.util.List.of("#", "##"),
                true,
                "llm_vision",
                "text-model-id",
                "vision-model-id",
                "llm-model-id",
                true,
                false,
                "order-20260711-001"
        );

        assertEquals("POST", capturedRequest.method());
        assertEquals("order-20260711-001", capturedRequest.header("Idempotency-Key"));
        Buffer buffer = new Buffer();
        capturedRequest.body().writeTo(buffer);
        String body = buffer.readUtf8();
        assertTrue(body.contains("name=\"file\"; filename=\"manual.pdf\""));
        assertTrue(body.contains("name=\"file_id\""));
        assertTrue(body.contains("existing-file-id"));
        assertTrue(body.contains("name=\"limit\""));
        assertTrue(body.contains("2048"));
        assertTrue(body.contains("name=\"patterns\""));
        assertTrue(body.contains("name=\"with_filter\""));
        assertTrue(body.contains("name=\"split_strategy\""));
        assertTrue(body.contains("llm_vision"));
        assertTrue(body.contains("name=\"model_id\""));
        assertTrue(body.contains("text-model-id"));
        assertTrue(body.contains("name=\"vision_model_id\""));
        assertTrue(body.contains("vision-model-id"));
        assertTrue(body.contains("name=\"llm_model_id\""));
        assertTrue(body.contains("llm-model-id"));
        assertTrue(body.contains("name=\"quality_optimize\""));
        assertTrue(body.contains("name=\"auto_apply\""));
    }

    @Test
    void uploadDocumentsShouldFallbackToManagementSplitTaskWhenOpenApiReturnsHtmlPage() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "manual.pdf",
                "application/pdf",
                "PDF".getBytes(StandardCharsets.UTF_8)
        );
        final int[] attempts = {0};
        doAnswer(invocation -> {
            attempts[0]++;
            return attempts[0] == 1
                    ? htmlResponse()
                    : jsonResponse("{\"code\":200,\"data\":{\"task_id\":\"legacy-task\",\"status\":\"queued\"}}");
        }).when(call).execute();

        Object response = service.uploadDocuments(
                1L,
                "kb-1",
                java.util.List.of((MultipartFile) file),
                java.util.List.of(),
                2048,
                java.util.List.of("#"),
                true,
                "",
                "",
                "",
                "",
                false,
                false,
                "order-20260716-001"
        );

        assertEquals(2, attempts[0]);
        assertEquals("POST", capturedRequest.method());
        assertEquals("/admin/api/workspace/ws-1/knowledge/kb-1/document/split/task", capturedRequest.url().encodedPath());
        assertEquals("Bearer mkb_secret_key", capturedRequest.header("Authorization"));
        assertInstanceOf(Map.class, response);
        Map<?, ?> responseMap = (Map<?, ?>) response;
        assertEquals("legacy-task", responseMap.get("task_id"));
        assertEquals("QUEUED", responseMap.get("status"));
    }

    @Test
    void uploadDocumentsShouldFallbackToManagementSplitTaskWhenOpenApiFailsWithUuid7() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "manual.pdf",
                "application/pdf",
                "PDF".getBytes(StandardCharsets.UTF_8)
        );
        final int[] attempts = {0};
        doAnswer(invocation -> {
            attempts[0]++;
            return attempts[0] == 1
                    ? jsonResponse("{\"code\":500,\"message\":\"module 'uuid' has no attribute 'uuid7'\"}")
                    : jsonResponse("{\"code\":200,\"data\":{\"task_id\":\"legacy-task\",\"status\":\"queued\"}}");
        }).when(call).execute();

        Object response = service.uploadDocuments(
                1L,
                "kb-1",
                java.util.List.of((MultipartFile) file),
                java.util.List.of(),
                2048,
                java.util.List.of("#"),
                true,
                "",
                "",
                "",
                "",
                false,
                false,
                "order-20260716-002"
        );

        assertEquals(2, attempts[0]);
        assertEquals("POST", capturedRequest.method());
        assertEquals("/admin/api/workspace/ws-1/knowledge/kb-1/document/split/task", capturedRequest.url().encodedPath());
        assertInstanceOf(Map.class, response);
        Map<?, ?> responseMap = (Map<?, ?>) response;
        assertEquals("legacy-task", responseMap.get("task_id"));
        assertEquals("QUEUED", responseMap.get("status"));
    }

    @Test
    void uploadTaskOperationsShouldUseDocumentUploadTaskPaths() {
        service.listUploadTasks(1L, "kb-1", Map.of("page", "1", "page_size", "20"));
        assertEquals("/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/upload-tasks", capturedRequest.url().encodedPath());
        assertTrue(capturedRequest.url().query().contains("page=1"));

        service.getUploadTask(1L, "kb-1", "task-1");
        assertEquals("/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/upload-tasks/task-1", capturedRequest.url().encodedPath());

        service.previewUploadTask(1L, "kb-1", "task-1", Map.of("page", "2"));
        assertEquals("/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/upload-tasks/task-1/preview", capturedRequest.url().encodedPath());
        assertTrue(capturedRequest.url().query().contains("page=2"));

        service.applyUploadTask(1L, "kb-1", "task-1");
        assertEquals("POST", capturedRequest.method());
        assertEquals("/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/upload-tasks/task-1/apply", capturedRequest.url().encodedPath());

        service.cancelUploadTask(1L, "kb-1", "task-1");
        assertEquals("POST", capturedRequest.method());
        assertEquals("/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/upload-tasks/task-1/cancel", capturedRequest.url().encodedPath());

        service.deleteUploadTask(1L, "kb-1", "task-1");
        assertEquals("DELETE", capturedRequest.method());
        assertEquals("/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/upload-tasks/task-1", capturedRequest.url().encodedPath());
    }

    @Test
    void legacyManagementUploadPreviewShouldReturnFlatPreviewRecords() throws Exception {
        final int[] attempts = {0};
        doAnswer(invocation -> {
            attempts[0]++;
            return attempts[0] == 1
                    ? htmlResponse()
                    : jsonResponse("""
                    {"code":200,"data":{"task_id":"legacy-task","status":"completed","progress":100,"processed":1,"total":1,"result":[{"name":"manual.pdf","source_file_id":"file-1","content":[{"title":"标题","content":"正文"}]}]}}
                    """);
        }).when(call).execute();

        Object response = service.previewUploadTask(1L, "kb-1", "legacy-task", Map.of("page", "1"));

        assertEquals(2, attempts[0]);
        assertEquals("GET", capturedRequest.method());
        assertEquals("/admin/api/workspace/ws-1/knowledge/kb-1/document/split/task/legacy-task", capturedRequest.url().encodedPath());
        Map<?, ?> responseMap = (Map<?, ?>) response;
        assertInstanceOf(java.util.List.class, responseMap.get("records"));
        java.util.List<?> records = (java.util.List<?>) responseMap.get("records");
        assertEquals(1, records.size());
        Map<?, ?> record = (Map<?, ?>) records.get(0);
        assertEquals("manual.pdf", record.get("document_name"));
        assertEquals("标题", record.get("title"));
        assertEquals("正文", record.get("content"));
    }

    @Test
    void legacyManagementUploadStatusShouldNormalizeCompletedTaskForPolling() throws Exception {
        final int[] attempts = {0};
        doAnswer(invocation -> {
            attempts[0]++;
            return attempts[0] == 1
                    ? htmlResponse()
                    : jsonResponse("""
                    {"code":200,"data":{"task_id":"legacy-task","status":"completed","progress":100,"processed":1,"total":1,"remaining":0,"message":"done","result":[{"name":"manual.pdf","content":[{"title":"标题","content":"正文"}]}]}}
                    """);
        }).when(call).execute();

        Object response = service.getUploadTask(1L, "kb-1", "legacy-task");

        assertEquals(2, attempts[0]);
        assertEquals("GET", capturedRequest.method());
        assertEquals("/admin/api/workspace/ws-1/knowledge/kb-1/document/split/task/legacy-task", capturedRequest.url().encodedPath());
        Map<?, ?> responseMap = (Map<?, ?>) response;
        assertEquals("legacy-task", responseMap.get("task_id"));
        assertEquals("PREVIEW_READY", responseMap.get("status"));
        assertEquals(100, responseMap.get("progress"));
    }

    @Test
    void legacyManagementUploadApplyShouldBatchCreatePreviewDocuments() throws Exception {
        final int[] attempts = {0};
        doAnswer(invocation -> {
            attempts[0]++;
            if (attempts[0] == 1) {
                return htmlResponse();
            }
            if (attempts[0] == 2) {
                return jsonResponse("""
                        {"code":200,"data":{"task_id":"legacy-task","status":"completed","result":[{"name":"manual.pdf","source_file_id":"file-1","content":[{"title":"标题","content":"正文"}]}]}}
                        """);
            }
            return jsonResponse("{\"code\":200,\"data\":{\"records\":[]}}");
        }).when(call).execute();

        service.applyUploadTask(1L, "kb-1", "legacy-task");

        assertEquals(3, attempts[0]);
        assertEquals("PUT", capturedRequest.method());
        assertEquals("/admin/api/workspace/ws-1/knowledge/kb-1/document/batch_create", capturedRequest.url().encodedPath());
        Buffer buffer = new Buffer();
        capturedRequest.body().writeTo(buffer);
        String body = buffer.readUtf8();
        assertTrue(body.contains("\"name\":\"manual.pdf\""));
        assertTrue(body.contains("\"paragraphs\""));
        assertTrue(body.contains("\"source_file_id\":\"file-1\""));
    }

    @Test
    void updateParagraphShouldForwardToKnowledgeParagraphPath() {
        service.updateParagraph(
                1L,
                "kb-1",
                "doc-1",
                "paragraph-1",
                Map.of("title", "标题", "content", "正文")
        );

        assertEquals("PUT", capturedRequest.method());
        assertEquals(
                "/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/doc-1/paragraphs/paragraph-1",
                capturedRequest.url().encodedPath()
        );
        assertEquals("Bearer mkb_secret_key", capturedRequest.header("Authorization"));
    }

    @Test
    void updateParagraphShouldFallbackToManagementEndpointWhenOpenApiDoesNotSupportWrites() throws Exception {
        final int[] attempts = {0};
        doAnswer(invocation -> {
            attempts[0]++;
            return attempts[0] == 1 ? notFoundResponse() : successfulResponse();
        }).when(call).execute();

        service.updateParagraph(
                1L,
                "kb-1",
                "doc-1",
                "paragraph-1",
                Map.of("title", "标题", "content", "正文")
        );

        assertEquals(2, attempts[0]);
        assertEquals("PUT", capturedRequest.method());
        assertEquals(
                "/admin/api/workspace/ws-1/knowledge/kb-1/document/doc-1/paragraph/paragraph-1",
                capturedRequest.url().encodedPath()
        );
        assertEquals("Bearer mkb_secret_key", capturedRequest.header("Authorization"));
    }

    @Test
    void updateParagraphShouldFallbackToManagementEndpointWhenOpenApiReturnsHtmlPage() throws Exception {
        final int[] attempts = {0};
        doAnswer(invocation -> {
            attempts[0]++;
            return attempts[0] == 1 ? htmlResponse() : successfulResponse();
        }).when(call).execute();

        service.updateParagraph(
                1L,
                "kb-1",
                "doc-1",
                "paragraph-1",
                Map.of("title", "标题", "content", "正文")
        );

        assertEquals(2, attempts[0]);
        assertEquals("PUT", capturedRequest.method());
        assertEquals(
                "/admin/api/workspace/ws-1/knowledge/kb-1/document/doc-1/paragraph/paragraph-1",
                capturedRequest.url().encodedPath()
        );
        assertEquals("Bearer mkb_secret_key", capturedRequest.header("Authorization"));
    }

    @Test
    void listParagraphProblemsShouldFallbackToManagementEndpointWhenOpenApiReturnsHtmlPage() throws Exception {
        final int[] attempts = {0};
        doAnswer(invocation -> {
            attempts[0]++;
            return attempts[0] == 1 ? htmlResponse() : successfulResponse();
        }).when(call).execute();

        service.listParagraphProblems(1L, "kb-1", "doc-1", "paragraph-1");

        assertEquals(2, attempts[0]);
        assertEquals("GET", capturedRequest.method());
        assertEquals(
                "/admin/api/workspace/ws-1/knowledge/kb-1/document/doc-1/paragraph/paragraph-1/problem",
                capturedRequest.url().encodedPath()
        );
        assertEquals("Bearer mkb_secret_key", capturedRequest.header("Authorization"));
    }

    @Test
    void htmlSuccessResponseShouldReturnEmptyUploadTaskHistoryWhenOpenApiEndpointIsMissing() throws Exception {
        doAnswer(invocation -> htmlResponse()).when(call).execute();

        Object response = service.listUploadTasks(1L, "kb-1", Map.of("page", "1"));

        assertInstanceOf(Map.class, response);
        Map<?, ?> responseMap = (Map<?, ?>) response;
        assertEquals(0, responseMap.get("total"));
        assertEquals(java.util.List.of(), responseMap.get("records"));
    }

    private Response successfulResponse() {
        return new Response.Builder()
                .request(capturedRequest)
                .protocol(Protocol.HTTP_1_1)
                .code(200)
                .message("OK")
                .body(ResponseBody.create(
                        "{\"code\":200,\"data\":{\"records\":[]}}",
                        MediaType.get("application/json")
                ))
                .build();
    }

    private Response jsonResponse(String json) {
        return new Response.Builder()
                .request(capturedRequest)
                .protocol(Protocol.HTTP_1_1)
                .code(200)
                .message("OK")
                .body(ResponseBody.create(json, MediaType.get("application/json")))
                .build();
    }

    private Response notFoundResponse() {
        return new Response.Builder()
                .request(capturedRequest)
                .protocol(Protocol.HTTP_1_1)
                .code(404)
                .message("Not Found")
                .body(ResponseBody.create(
                        "{\"detail\":\"Not found\"}",
                        MediaType.get("application/json")
                ))
                .build();
    }

    private Response htmlResponse() {
        return new Response.Builder()
                .request(capturedRequest)
                .protocol(Protocol.HTTP_1_1)
                .code(200)
                .message("OK")
                .body(ResponseBody.create(
                        "<!doctype html><html><body>MaxKB</body></html>",
                        MediaType.get("text/html; charset=utf-8")
                ))
                .build();
    }
}
