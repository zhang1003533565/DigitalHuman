package com.digitalhuman.backend_java.config;

import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.service.AuthTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

/**
 * 回归测试：错误响应必须带 message 与 traceId。
 *
 * <p>前端 getApiProblem 只认响应体里的 message/detail 字段；若后端退回
 * Spring Boot 默认的 /error 结构（只有 timestamp/status/error/path），
 * 业务提示会全部退化为通用兜底文案。这里通过真实 HTTP 调用锁住该契约。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApiExceptionHandlerTests {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate rest;

    @MockBean
    private AuthTokenService authTokenService;

    private String url(String path) {
        return "http://127.0.0.1:" + port + path;
    }

    private HttpEntity<String> orderRequest(String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth("a");
        return new HttpEntity<>(body, headers);
    }

    @Test
    void validationFailureReturnsReadableMessage() {
        when(authTokenService.getSession("a"))
                .thenReturn(Optional.of(new AuthSession(7L, "v", "v", UserRole.USER)));

        ResponseEntity<String> response = rest.exchange(
                url("/api/user/mall/orders"),
                HttpMethod.POST,
                orderRequest("""
                        {"receiverName":"小明","receiverPhone":"12345","items":[{"productId":"p","quantity":1}]}
                        """),
                String.class);

        assertEquals(400, response.getStatusCode().value());
        String body = response.getBody();
        assertNotNull(body);
        assertTrue(body.contains("\"code\":\"VALIDATION_FAILED\""), body);
        assertTrue(body.contains("手机号"), body);
        assertTrue(body.contains("\"traceId\""), body);
    }

    @Test
    void businessFailureReturnsReadableMessageAndStatus() {
        when(authTokenService.getSession("a"))
                .thenReturn(Optional.of(new AuthSession(7L, "v", "v", UserRole.USER)));

        ResponseEntity<String> response = rest.exchange(
                url("/api/user/mall/orders"),
                HttpMethod.POST,
                orderRequest("""
                        {"receiverName":"小明","receiverPhone":"13800000000","items":[{"productId":"missing","quantity":1}]}
                        """),
                String.class);

        assertEquals(404, response.getStatusCode().value());
        String body = response.getBody();
        assertNotNull(body);
        assertTrue(body.contains("\"code\":\"NOT_FOUND\""), body);
        assertTrue(body.contains("商品"), body);
        assertFalse(body.contains("\"error\":\"Not Found\""), "不应退回 Spring 默认错误结构: " + body);
    }

    @Test
    void clientSuppliedTraceIdIsEchoedBackOnErrors() {
        when(authTokenService.getSession("a"))
                .thenReturn(Optional.of(new AuthSession(7L, "v", "v", UserRole.USER)));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth("a");
        headers.set(TraceIdFilter.TRACE_ID_HEADER, "probe-trace-12345678");

        ResponseEntity<String> response = rest.exchange(
                url("/api/user/mall/orders"),
                HttpMethod.POST,
                new HttpEntity<>("""
                        {"receiverName":"小明","receiverPhone":"12345","items":[{"productId":"p","quantity":1}]}
                        """, headers),
                String.class);

        String body = response.getBody();
        assertNotNull(body);
        assertTrue(body.contains("probe-trace-12345678"), "traceId 应回显到错误体便于排查: " + body);
    }

    @Test
    void validationFailureOnEmptyItemsIsReported() {
        when(authTokenService.getSession("a"))
                .thenReturn(Optional.of(new AuthSession(7L, "v", "v", UserRole.USER)));

        ResponseEntity<String> response = rest.exchange(
                url("/api/user/mall/orders"),
                HttpMethod.POST,
                orderRequest("""
                        {"receiverName":"小明","receiverPhone":"13800000000","items":[]}
                        """),
                String.class);

        assertEquals(400, response.getStatusCode().value());
        String body = response.getBody();
        assertNotNull(body);
        assertTrue(body.contains("订单商品不能为空"), body);
    }
}
