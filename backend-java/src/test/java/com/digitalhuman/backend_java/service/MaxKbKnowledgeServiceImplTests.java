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
    void uploadDocumentsShouldNotCallManagementEndpointWhenOpenApiReturnsHtmlPage() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "manual.pdf",
                "application/pdf",
                "PDF".getBytes(StandardCharsets.UTF_8)
        );
        doAnswer(invocation -> htmlResponse()).when(call).execute();

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.uploadDocuments(
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
                )
        );

        assertEquals(502, error.getStatusCode().value());
        assertTrue(error.getReason().contains("MaxKB 返回了 HTML 页面"));
        assertEquals("POST", capturedRequest.method());
        assertEquals(
                "/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/upload",
                capturedRequest.url().encodedPath()
        );
    }

    @Test
    void uploadDocumentsShouldNotCallManagementEndpointWhenOpenApiFailsWithUuid7() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "manual.pdf",
                "application/pdf",
                "PDF".getBytes(StandardCharsets.UTF_8)
        );
        doAnswer(invocation -> jsonResponse("{\"code\":500,\"message\":\"module 'uuid' has no attribute 'uuid7'\"}"))
                .when(call).execute();

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.uploadDocuments(
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
                )
        );

        assertEquals(502, error.getStatusCode().value());
        assertTrue(error.getReason().contains("uuid7"));
        assertEquals("POST", capturedRequest.method());
        assertEquals(
                "/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/upload",
                capturedRequest.url().encodedPath()
        );
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
    void uploadTaskPreviewShouldNotCallManagementEndpointWhenOpenApiIsUnavailable() throws Exception {
        doAnswer(invocation -> htmlResponse()).when(call).execute();

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.previewUploadTask(1L, "kb-1", "legacy-task", Map.of("page", "1"))
        );

        assertEquals(502, error.getStatusCode().value());
        assertTrue(error.getReason().contains("MaxKB 返回了 HTML 页面"));
        assertEquals("GET", capturedRequest.method());
        assertEquals(
                "/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/upload-tasks/legacy-task/preview",
                capturedRequest.url().encodedPath()
        );
    }

    @Test
    void uploadTaskStatusShouldNotCallManagementEndpointWhenOpenApiIsUnavailable() throws Exception {
        doAnswer(invocation -> htmlResponse()).when(call).execute();

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.getUploadTask(1L, "kb-1", "legacy-task")
        );

        assertEquals(502, error.getStatusCode().value());
        assertTrue(error.getReason().contains("MaxKB 返回了 HTML 页面"));
        assertEquals("GET", capturedRequest.method());
        assertEquals(
                "/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/upload-tasks/legacy-task",
                capturedRequest.url().encodedPath()
        );
    }

    @Test
    void uploadTaskApplyShouldNotCallManagementEndpointWhenOpenApiIsUnavailable() throws Exception {
        doAnswer(invocation -> htmlResponse()).when(call).execute();

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.applyUploadTask(1L, "kb-1", "legacy-task")
        );

        assertEquals(502, error.getStatusCode().value());
        assertTrue(error.getReason().contains("MaxKB 返回了 HTML 页面"));
        assertEquals("POST", capturedRequest.method());
        assertEquals(
                "/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/upload-tasks/legacy-task/apply",
                capturedRequest.url().encodedPath()
        );
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
    void updateParagraphShouldNotCallManagementEndpointWhenOpenApiWriteIsUnavailable() throws Exception {
        doAnswer(invocation -> htmlResponse()).when(call).execute();

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.updateParagraph(
                        1L,
                        "kb-1",
                        "doc-1",
                        "paragraph-1",
                        Map.of("title", "标题", "content", "正文")
                )
        );

        assertEquals(502, error.getStatusCode().value());
        assertTrue(error.getReason().contains("MaxKB 返回了 HTML 页面"));
        assertEquals("PUT", capturedRequest.method());
        assertEquals(
                "/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/doc-1/paragraphs/paragraph-1",
                capturedRequest.url().encodedPath()
        );
    }

    @Test
    void listParagraphProblemsShouldNotCallManagementEndpointWhenOpenApiIsUnavailable() throws Exception {
        doAnswer(invocation -> htmlResponse()).when(call).execute();

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.listParagraphProblems(1L, "kb-1", "doc-1", "paragraph-1")
        );

        assertEquals(502, error.getStatusCode().value());
        assertTrue(error.getReason().contains("MaxKB 返回了 HTML 页面"));
        assertEquals("GET", capturedRequest.method());
        assertEquals(
                "/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/doc-1/paragraphs/paragraph-1/problem",
                capturedRequest.url().encodedPath()
        );
    }

    @Test
    void uploadTaskHistoryShouldNotHideMissingOpenApiEndpoint() throws Exception {
        doAnswer(invocation -> htmlResponse()).when(call).execute();

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.listUploadTasks(1L, "kb-1", Map.of("page", "1"))
        );

        assertEquals(502, error.getStatusCode().value());
        assertTrue(error.getReason().contains("MaxKB 返回了 HTML 页面"));
        assertEquals("GET", capturedRequest.method());
        assertEquals(
                "/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents/upload-tasks",
                capturedRequest.url().encodedPath()
        );
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
