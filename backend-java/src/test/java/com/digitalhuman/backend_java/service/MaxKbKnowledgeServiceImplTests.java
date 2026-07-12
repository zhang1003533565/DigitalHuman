package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.MaxKbAccount;
import com.digitalhuman.backend_java.repository.MaxKbAccountRepository;
import com.digitalhuman.backend_java.service.impl.MaxKbKnowledgeServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;
import okhttp3.Call;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.springframework.test.util.ReflectionTestUtils;

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
