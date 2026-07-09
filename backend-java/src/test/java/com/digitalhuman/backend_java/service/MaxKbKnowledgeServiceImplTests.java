package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.MaxKbAccount;
import com.digitalhuman.backend_java.repository.MaxKbAccountRepository;
import com.digitalhuman.backend_java.service.impl.MaxKbKnowledgeServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MaxKbKnowledgeServiceImplTests {

    private HttpServer server;
    private MaxKbKnowledgeServiceImpl service;
    private String capturedAuthorization;
    private String capturedQuery;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/openapi/knowledge/v1/workspaces/ws-1/knowledges/kb-1/documents", this::handleDocuments);
        server.start();

        MaxKbAccount account = new MaxKbAccount();
        account.setId(1L);
        account.setAccountName("景区知识库");
        account.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
        account.setApiKey("mkb_secret_key");
        account.setWorkspaceId("ws-1");
        account.setStatus(1);

        MaxKbAccountRepository repository = mock(MaxKbAccountRepository.class);
        when(repository.findById(1L)).thenReturn(Optional.of(account));
        service = new MaxKbKnowledgeServiceImpl(repository, new ObjectMapper(), 5);
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void listDocumentsShouldForwardBearerKeyAndDefaultTaskType() {
        Object response = service.listDocuments(1L, "kb-1", Map.of("page", "1"));

        assertInstanceOf(Map.class, response);
        assertEquals("Bearer mkb_secret_key", capturedAuthorization);
        assertTrue(capturedQuery.contains("page=1"));
        assertTrue(capturedQuery.contains("task_type=1"));
    }

    private void handleDocuments(HttpExchange exchange) throws IOException {
        capturedAuthorization = exchange.getRequestHeaders().getFirst("Authorization");
        capturedQuery = exchange.getRequestURI().getRawQuery();
        byte[] payload = "{\"code\":200,\"data\":{\"records\":[]}}".getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, payload.length);
        exchange.getResponseBody().write(payload);
        exchange.close();
    }
}
