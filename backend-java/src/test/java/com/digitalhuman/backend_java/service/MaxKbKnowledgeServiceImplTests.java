package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.MaxKbAccount;
import com.digitalhuman.backend_java.repository.MaxKbAccountRepository;
import com.digitalhuman.backend_java.service.impl.MaxKbKnowledgeServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MaxKbKnowledgeServiceImplTests {

    private MaxKbKnowledgeServiceImpl service;
    private Request capturedRequest;

    @BeforeEach
    void setUp() throws Exception {
        MaxKbAccount account = new MaxKbAccount();
        account.setId(1L);
        account.setAccountName("景区知识库");
        account.setBaseUrl("http://maxkb.test");
        account.setApiKey("mkb_secret_key");
        account.setWorkspaceId("ws-1");
        account.setStatus(1);

        MaxKbAccountRepository repository = mock(MaxKbAccountRepository.class);
        when(repository.findById(1L)).thenReturn(Optional.of(account));
        service = new MaxKbKnowledgeServiceImpl(repository, new ObjectMapper(), 5);
        OkHttpClient httpClient = mock(OkHttpClient.class);
        Call call = mock(Call.class);
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
}
