package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.MaxKbOpenApiConfig;
import com.digitalhuman.backend_java.repository.MaxKbOpenApiConfigRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class MaxKbService {

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    @Value("${maxkb.base-url:http://localhost:3000}")
    private String maxKbBaseUrl;

    @Value("${maxkb.api-key:}")
    private String maxKbApiKey;

    @Value("${maxkb.workspace-id:default}")
    private String workspaceId;

    @Value("${maxkb.default-knowledge-id:}")
    private String defaultKnowledgeId;

    private final MaxKbOpenApiConfigRepository configRepository;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    public MaxKbService(ObjectMapper objectMapper, MaxKbOpenApiConfigRepository configRepository) {
        this.objectMapper = objectMapper;
        this.configRepository = configRepository;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(90, TimeUnit.SECONDS)
                .writeTimeout(90, TimeUnit.SECONDS)
                .build();
    }

    public JsonNode docs() {
        RuntimeConfig config = effectiveConfig();
        HttpUrl url = HttpUrl.parse(openApiRoot(config) + "/docs");
        if (url == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "MaxKB Docs URL 配置不合法");
        }
        return executeJson(new Request.Builder().url(url).get().build());
    }

    public JsonNode currentConfig() {
        RuntimeConfig config = effectiveConfig();
        ObjectNode node = objectMapper.createObjectNode();
        node.put("adminBaseUrl", config.adminBaseUrl());
        node.put("workspaceId", config.workspaceId());
        node.put("accessUrl", config.accessUrl());
        node.put("apiKey", config.apiKey());
        node.put("keyId", config.keyId());
        node.put("keyName", config.keyName());
        node.put("defaultKnowledgeId", config.defaultKnowledgeId());
        node.put("configured", !config.apiKey().isBlank() && !config.accessUrl().isBlank());
        return node;
    }

    public JsonNode saveConfig(Map<String, Object> payload) {
        RuntimeConfig current = effectiveConfig();
        String adminBaseUrl = firstNonBlank(text(payload, "adminBaseUrl"), current.adminBaseUrl(), maxKbBaseUrl);
        String workspace = firstNonBlank(text(payload, "workspaceId"), extractWorkspaceId(text(payload, "accessUrl")), current.workspaceId(), workspaceId, "default");
        String accessUrl = firstNonBlank(text(payload, "accessUrl"), buildAccessUrl(adminBaseUrl, workspace));
        String apiKey = firstNonBlank(text(payload, "apiKey"), current.apiKey(), maxKbApiKey);

        MaxKbOpenApiConfig config = configRepository.findById("default").orElseGet(MaxKbOpenApiConfig::new);
        config.setId("default");
        config.setAdminBaseUrl(trimTrailingSlash(adminBaseUrl));
        config.setWorkspaceId(workspace);
        config.setAccessUrl(trimTrailingSlash(accessUrl));
        config.setApiKey(apiKey);
        config.setKeyId(text(payload, "keyId"));
        config.setKeyName(text(payload, "keyName"));
        config.setDefaultKnowledgeId(firstNonBlank(text(payload, "defaultKnowledgeId"), current.defaultKnowledgeId()));
        config.setUpdatedAt(LocalDateTime.now());
        configRepository.save(config);
        return currentConfig();
    }

    public JsonNode syncOpenApiKeys(Map<String, Object> payload) {
        String adminBaseUrl = firstNonBlank(text(payload, "adminBaseUrl"), maxKbBaseUrl, "http://localhost:3000");
        String workspace = firstNonBlank(text(payload, "workspaceId"), workspaceId, "default");
        String adminToken = normalize(text(payload, "adminToken"));
        if (adminToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写 MaxKB 管理端 Token");
        }

        HttpUrl url = HttpUrl.parse(trimTrailingSlash(adminBaseUrl) + "/admin/api/system/openapi/keys");
        if (url == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MaxKB 管理端地址不合法");
        }
        Request request = new Request.Builder()
                .url(url.newBuilder().addQueryParameter("workspace_id", workspace).build())
                .header("Authorization", adminToken.startsWith("Bearer ") ? adminToken : "Bearer " + adminToken)
                .get()
                .build();
        JsonNode root = executeJson(request);
        ArrayNode keys = objectMapper.createArrayNode();
        JsonNode data = root.path("data");
        if (data.isArray()) {
            data.forEach(keys::add);
        } else if (root.isArray()) {
            root.forEach(keys::add);
        }

        ObjectNode response = objectMapper.createObjectNode();
        response.put("adminBaseUrl", trimTrailingSlash(adminBaseUrl));
        response.put("workspaceId", workspace);
        response.put("accessUrl", buildAccessUrl(adminBaseUrl, workspace));
        response.set("keys", keys);
        return response;
    }

    public JsonNode listKnowledges(Map<String, String> query) {
        return get(workspacePath("/knowledges"), query);
    }

    public JsonNode getKnowledge(String knowledgeId) {
        return get(workspacePath("/knowledges/" + knowledgeId), Map.of());
    }

    public JsonNode listDocuments(String knowledgeId, Map<String, String> query) {
        Map<String, String> normalizedQuery = new LinkedHashMap<>();
        if (query != null) {
            normalizedQuery.putAll(query);
        }
        normalizedQuery.putIfAbsent("task_type", "1");
        return get(workspacePath("/knowledges/" + knowledgeId + "/documents"), normalizedQuery);
    }

    public JsonNode listParagraphs(String knowledgeId, String documentId, Map<String, String> query) {
        return get(workspacePath("/knowledges/" + knowledgeId + "/documents/" + documentId + "/paragraphs"), query);
    }

    public JsonNode listParagraphProblems(String knowledgeId, String documentId, String paragraphId) {
        String openApiPath = workspacePath(
                "/knowledges/" + knowledgeId
                        + "/documents/" + documentId
                        + "/paragraphs/" + paragraphId
                        + "/problem");
        try {
            return get(openApiPath, Map.of());
        } catch (ResponseStatusException exception) {
            if (!shouldTryManagementFallback(exception)) {
                throw exception;
            }
            RuntimeConfig config = effectiveConfig();
            return getManagement(
                    config,
                    "/admin/api/workspace/" + config.workspaceId()
                            + "/knowledge/" + knowledgeId
                            + "/document/" + documentId
                            + "/paragraph/" + paragraphId
                            + "/problem");
        }
    }

    public JsonNode updateParagraph(String knowledgeId, String documentId, String paragraphId, Map<String, Object> payload) {
        Map<String, Object> normalizedPayload = normalizeParagraphPayload(payload);
        String openApiPath = workspacePath(
                "/knowledges/" + knowledgeId
                        + "/documents/" + documentId
                        + "/paragraphs/" + paragraphId);
        try {
            return putJson(openApiPath, normalizedPayload);
        } catch (ResponseStatusException exception) {
            if (!shouldTryManagementFallback(exception)) {
                throw exception;
            }
            RuntimeConfig config = effectiveConfig();
            return putManagementJson(
                    config,
                    "/admin/api/workspace/" + config.workspaceId()
                            + "/knowledge/" + knowledgeId
                            + "/document/" + documentId
                            + "/paragraph/" + paragraphId,
                    normalizedPayload);
        }
    }

    public JsonNode hitTest(Map<String, Object> payload) {
        return postJson(workspacePath("/hit-test"), payload);
    }

    public JsonNode hitTest(String queryText, String knowledgeId) {
        String selectedKnowledgeId = normalize(knowledgeId);
        if (selectedKnowledgeId.isBlank()) {
            selectedKnowledgeId = effectiveConfig().defaultKnowledgeId();
        }
        if (selectedKnowledgeId.isBlank()) {
            return objectMapper.createObjectNode();
        }
        return hitTest(Map.of(
                "knowledge_id", selectedKnowledgeId,
                "query_text", queryText == null ? "" : queryText,
                "top_number", 5,
                "similarity", 0.6,
                "search_mode", "blend"
        ));
    }

    public String getDefaultKnowledgeId() {
        return effectiveConfig().defaultKnowledgeId();
    }

    private JsonNode get(String path, Map<String, String> query) {
        Request request = baseRequest(path, query).get().build();
        return executeJson(request);
    }

    private JsonNode postJson(String path, Map<String, Object> payload) {
        ensureConfigured();
        try {
            Request request = baseRequest(path)
                    .post(RequestBody.create(objectMapper.writeValueAsString(payload), JSON))
                    .build();
            return executeJson(request);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "构造 MaxKB 请求失败", exception);
        }
    }

    private JsonNode putJson(String path, Map<String, Object> payload) {
        ensureConfigured();
        try {
            Request request = baseRequest(path)
                    .put(RequestBody.create(objectMapper.writeValueAsString(payload), JSON))
                    .build();
            return executeJson(request);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "构造 MaxKB 请求失败", exception);
        }
    }

    private JsonNode getManagement(RuntimeConfig config, String path) {
        Request request = managementRequest(config, path).get().build();
        return executeJson(request);
    }

    private JsonNode putManagementJson(RuntimeConfig config, String path, Map<String, Object> payload) {
        ensureConfigured(config);
        try {
            Request request = managementRequest(config, path)
                    .put(RequestBody.create(objectMapper.writeValueAsString(payload), JSON))
                    .build();
            return executeJson(request);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "构造 MaxKB 请求失败", exception);
        }
    }

    private Request.Builder managementRequest(RuntimeConfig config, String path) {
        ensureConfigured(config);
        HttpUrl url = HttpUrl.parse(trimTrailingSlash(config.adminBaseUrl()) + path);
        if (url == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "MaxKB 管理端 URL 配置不合法");
        }
        return new Request.Builder()
                .url(url)
                .header("Authorization", "Bearer " + config.apiKey());
    }

    private Request.Builder baseRequest(String path) {
        return baseRequest(path, Map.of());
    }

    private Request.Builder baseRequest(String path, Map<String, String> query) {
        RuntimeConfig config = effectiveConfig();
        ensureConfigured(config);
        HttpUrl baseUrl = HttpUrl.parse(openApiRoot(config) + path);
        if (baseUrl == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "MaxKB Base URL 配置不合法");
        }
        HttpUrl.Builder urlBuilder = baseUrl.newBuilder();
        if (query != null) {
            query.forEach((key, value) -> {
                if (key != null && value != null && !value.isBlank()) {
                    urlBuilder.addQueryParameter(key, value);
                }
            });
        }
        return new Request.Builder()
                .url(urlBuilder.build())
                .header("Authorization", "Bearer " + config.apiKey());
    }

    private JsonNode executeJson(Request request) {
        try (Response response = httpClient.newCall(request).execute()) {
            String body = response.body() == null ? "" : response.body().string();
            if (!response.isSuccessful()) {
                throw new ResponseStatusException(
                        toHttpStatus(response.code()),
                        body.isBlank() ? "MaxKB 请求失败: " + response.code() : body);
            }
            if (body.isBlank()) {
                return objectMapper.createObjectNode();
            }
            return objectMapper.readTree(body);
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "无法连接 MaxKB: " + exception.getMessage(), exception);
        }
    }

    private String workspacePath(String suffix) {
        return "/workspaces/" + effectiveConfig().workspaceId() + suffix;
    }

    private HttpStatus toHttpStatus(int code) {
        try {
            return HttpStatus.valueOf(code);
        } catch (Exception ignored) {
            return HttpStatus.BAD_GATEWAY;
        }
    }

    private boolean shouldTryManagementFallback(ResponseStatusException exception) {
        HttpStatusCode statusCode = exception.getStatusCode();
        return statusCode.isSameCodeAs(HttpStatus.NOT_FOUND)
                || statusCode.isSameCodeAs(HttpStatus.METHOD_NOT_ALLOWED)
                || statusCode.isSameCodeAs(HttpStatus.BAD_REQUEST);
    }

    private Map<String, Object> normalizeParagraphPayload(Map<String, Object> payload) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        String title = text(payload, "title");
        String content = text(payload, "content");
        if (!title.isBlank()) {
            normalized.put("title", title);
        }
        normalized.put("content", content);
        Object isActive = payload == null ? null : payload.get("is_active");
        normalized.put("is_active", isActive instanceof Boolean ? isActive : true);
        Object problemList = payload == null ? null : payload.get("problem_list");
        if (problemList instanceof Iterable<?> || problemList instanceof Object[]) {
            normalized.put("problem_list", problemList);
        }
        return normalized;
    }

    private void ensureConfigured() {
        ensureConfigured(effectiveConfig());
    }

    private void ensureConfigured(RuntimeConfig config) {
        if (config.accessUrl().isBlank() && config.adminBaseUrl().isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "未配置 MaxKB 访问地址");
        }
        if (config.apiKey().isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "未配置 MaxKB API Key");
        }
        if (config.workspaceId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "未配置 MaxKB 工作空间");
        }
    }

    private RuntimeConfig effectiveConfig() {
        MaxKbOpenApiConfig saved = configRepository.findById("default").orElse(null);
        if (saved != null && !normalize(saved.getApiKey()).isBlank()) {
            String workspace = firstNonBlank(saved.getWorkspaceId(), extractWorkspaceId(saved.getAccessUrl()), workspaceId, "default");
            String adminBase = firstNonBlank(saved.getAdminBaseUrl(), deriveAdminBaseUrl(saved.getAccessUrl()), maxKbBaseUrl);
            String access = firstNonBlank(saved.getAccessUrl(), buildAccessUrl(adminBase, workspace));
            return new RuntimeConfig(
                    trimTrailingSlash(adminBase),
                    workspace,
                    trimTrailingSlash(access),
                    normalize(saved.getApiKey()),
                    normalize(saved.getKeyId()),
                    normalize(saved.getKeyName()),
                    firstNonBlank(saved.getDefaultKnowledgeId(), defaultKnowledgeId)
            );
        }
        String workspace = firstNonBlank(workspaceId, "default");
        String adminBase = firstNonBlank(maxKbBaseUrl, "http://localhost:3000");
        return new RuntimeConfig(
                trimTrailingSlash(adminBase),
                workspace,
                buildAccessUrl(adminBase, workspace),
                normalize(maxKbApiKey),
                "",
                "",
                normalize(defaultKnowledgeId)
        );
    }

    private String openApiRoot(RuntimeConfig config) {
        String accessUrl = trimTrailingSlash(config.accessUrl());
        int workspaceIndex = accessUrl.indexOf("/workspaces/");
        if (workspaceIndex > 0) {
            return accessUrl.substring(0, workspaceIndex);
        }
        return trimTrailingSlash(config.adminBaseUrl()) + "/openapi/knowledge/v1";
    }

    private String buildAccessUrl(String adminBaseUrl, String workspace) {
        return trimTrailingSlash(adminBaseUrl) + "/openapi/knowledge/v1/workspaces/" + normalize(workspace);
    }

    private String deriveAdminBaseUrl(String accessUrl) {
        String normalized = normalize(accessUrl);
        int index = normalized.indexOf("/openapi/knowledge/v1");
        if (index > 0) {
            return normalized.substring(0, index);
        }
        return normalized;
    }

    private String extractWorkspaceId(String accessUrl) {
        String normalized = normalize(accessUrl);
        int index = normalized.indexOf("/workspaces/");
        if (index < 0) {
            return "";
        }
        String workspace = normalized.substring(index + "/workspaces/".length());
        int slash = workspace.indexOf('/');
        return slash >= 0 ? workspace.substring(0, slash) : workspace;
    }

    private String trimTrailingSlash(String value) {
        String normalized = normalize(value);
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private String text(Map<String, Object> payload, String key) {
        if (payload == null) {
            return "";
        }
        Object value = payload.get(key);
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = normalize(value);
            if (!normalized.isBlank()) {
                return normalized;
            }
        }
        return "";
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private record RuntimeConfig(
            String adminBaseUrl,
            String workspaceId,
            String accessUrl,
            String apiKey,
            String keyId,
            String keyName,
            String defaultKnowledgeId) {
    }
}
