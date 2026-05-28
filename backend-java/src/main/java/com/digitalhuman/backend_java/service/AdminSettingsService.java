package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.AdminModelCatalogDto;
import com.digitalhuman.backend_java.dto.AdminModelOptionDto;
import com.digitalhuman.backend_java.dto.AdminProviderDocDto;
import com.digitalhuman.backend_java.dto.AdminProviderConfigDto;
import com.digitalhuman.backend_java.dto.AdminModelSettingsDto;
import com.digitalhuman.backend_java.dto.AdminModelTestRequestDto;
import com.digitalhuman.backend_java.dto.AdminModelTestResponseDto;
import com.digitalhuman.backend_java.dto.AgentCatalogItemDto;
import com.digitalhuman.backend_java.dto.AgentCatalogResponseDto;
import com.digitalhuman.backend_java.dto.AgentModelBindingItemDto;
import com.digitalhuman.backend_java.dto.AgentModelBindingPayloadDto;
import com.digitalhuman.backend_java.dto.RagLlmConfigDto;
import com.digitalhuman.backend_java.dto.RagPromptConfigDto;
import com.digitalhuman.backend_java.dto.RagRetrievalConfigDto;
import com.digitalhuman.backend_java.model.AdminModelConfig;
import com.digitalhuman.backend_java.model.ModelCategory;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminSettingsService {
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final Path PROJECT_ROOT = Path.of("").toAbsolutePath().getParent();
    private static final Path AI_SERVICE_ROOT = PROJECT_ROOT.resolve("ai-service");
    private static final Map<String, String> PROVIDER_DOC_FILES = Map.of(
            "DeepSeek", "model_providers/deepseek/docs/models.md",
            "Qwen", "model_providers/qwen/docs/models.md",
            "Volcengine", "model_providers/volcengine/docs/models.md",
            "Xunfei", "model_providers/xunfei/docs/models.md",
            "Local TTS", "model_providers/local_tts/docs/models.md"
    );

    @Value("${rag.service-url}")
    private String ragServiceUrl;

    private final AdminModelConfigRepository adminModelConfigRepository;
    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;

    public AdminSettingsService(AdminModelConfigRepository adminModelConfigRepository, ObjectMapper objectMapper) {
        this.adminModelConfigRepository = adminModelConfigRepository;
        this.objectMapper = objectMapper;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .build();
    }

    @Transactional(readOnly = true)
    public AdminModelSettingsDto getModelSettings() {
        return new AdminModelSettingsDto(
                getSelectedModelId(ModelCategory.EMBEDDING, ""),
                getSelectedModelId(ModelCategory.SPEECH, ""),
                getSelectedModelId(ModelCategory.VISION, ""),
                getSelectedModelId(ModelCategory.CHAT, ""),
                getSelectedModelId(ModelCategory.MULTIMODAL, "")
        );
    }

    @Transactional
    public AdminModelSettingsDto updateModelSettings(AdminModelSettingsDto request) {
        updateSelectedModel(ModelCategory.EMBEDDING, normalize(request.getEmbeddingModel(), ""));
        updateSelectedModel(ModelCategory.SPEECH, normalize(request.getSpeechModel(), ""));
        updateSelectedModel(ModelCategory.VISION, normalize(request.getVisionModel(), ""));
        updateSelectedModel(ModelCategory.CHAT, normalize(request.getChatModel(), ""));
        updateSelectedModel(ModelCategory.MULTIMODAL, normalize(request.getMultimodalModel(), ""));
        return getModelSettings();
    }

    @Transactional(readOnly = true)
    public AdminModelCatalogDto getModelCatalog() {
        return new AdminModelCatalogDto(
                toOptionDtos(ModelCategory.EMBEDDING),
                toOptionDtos(ModelCategory.SPEECH),
                toOptionDtos(ModelCategory.VISION),
                toOptionDtos(ModelCategory.CHAT),
                toOptionDtos(ModelCategory.MULTIMODAL)
        );
    }

    @Transactional
    public AdminModelCatalogDto addModelOption(AdminModelOptionDto request) {
        ModelCategory category = normalizeCategory(request.getCategory());
        String modelId = normalize(request.getModelId(), "");
        String provider = normalize(request.getProvider(), "");
        if (modelId.isBlank()) {
            throw new IllegalArgumentException("模型 ID 不能为空");
        }
        if (provider.isBlank()) {
            throw new IllegalArgumentException("模型提供方不能为空");
        }
        ensureProviderConfigured(provider);

        adminModelConfigRepository.findByCategoryAndModelIdIgnoreCase(category, modelId)
                .orElseGet(() -> {
                    AdminModelConfig item = new AdminModelConfig();
                    item.setCategory(category);
                    item.setProvider(provider);
                    item.setModelId(modelId);
                    item.setSelected(false);
                    return adminModelConfigRepository.save(item);
                });

        return getModelCatalog();
    }

    @Transactional
    public AdminModelCatalogDto removeModelOption(AdminModelOptionDto request) {
        ModelCategory category = normalizeCategory(request.getCategory());
        String modelId = normalize(request.getModelId(), "");
        if (modelId.isBlank()) {
            throw new IllegalArgumentException("模型 ID 不能为空");
        }

        AdminModelConfig item = adminModelConfigRepository.findByCategoryAndModelIdIgnoreCase(category, modelId)
                .orElseThrow(() -> new IllegalArgumentException("未找到要删除的模型"));
        adminModelConfigRepository.delete(item);
        return getModelCatalog();
    }

    @Transactional
    public AdminModelSettingsDto selectModelOption(AdminModelOptionDto request) {
        ModelCategory category = normalizeCategory(request.getCategory());
        String modelId = normalize(request.getModelId(), "");
        String provider = normalize(request.getProvider(), "");
        if (modelId.isBlank()) {
            throw new IllegalArgumentException("模型 ID 不能为空");
        }
        ensureProviderConfigured(provider);

        updateSelectedModel(category, modelId);
        return getModelSettings();
    }

    @Transactional(readOnly = true)
    public List<AdminProviderConfigDto> getProviderConfigs() {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/admin/providers")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("ai-service provider list failed: " + response.code());
            }
            return objectMapper.readValue(response.body().string(), new TypeReference<>() {});
        } catch (Exception exception) {
            throw new IllegalArgumentException("读取模型提供方配置失败", exception);
        }
    }

    @Transactional
    public AdminProviderConfigDto saveProviderConfig(AdminProviderConfigDto request) {
        String provider = normalize(request.getProvider(), "");
        String baseUrl = normalize(request.getBaseUrl(), "");
        String apiKey = normalize(request.getApiKey(), "");
        if (provider.isBlank() || baseUrl.isBlank() || apiKey.isBlank()) {
            throw new IllegalArgumentException("提供方、Base URL、API Key 都不能为空");
        }

        try {
            String payload = objectMapper.writeValueAsString(request);
            Request httpRequest = new Request.Builder()
                    .url(ragServiceUrl + "/admin/providers")
                    .put(RequestBody.create(payload, JSON))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    throw new IOException("ai-service provider save failed: " + response.code());
                }
                return objectMapper.readValue(response.body().string(), AdminProviderConfigDto.class);
            }
        } catch (Exception exception) {
            throw new IllegalArgumentException("保存模型提供方配置失败", exception);
        }
    }

    @Transactional
    public void deleteProviderConfig(AdminProviderConfigDto request) {
        String provider = normalize(request.getProvider(), "");
        if (provider.isBlank()) {
            throw new IllegalArgumentException("模型提供方不能为空");
        }
        List<AdminModelConfig> attachedModels = adminModelConfigRepository.findByProviderIgnoreCaseOrderByCategoryAscModelIdAsc(provider);
        if (!attachedModels.isEmpty()) {
            String details = attachedModels.stream()
                    .map(item -> toCategoryKey(item.getCategory()) + ":" + item.getModelId())
                    .limit(5)
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("");
            throw new IllegalArgumentException("请先删除该提供方下的模型，再删除提供方配置。当前仍关联模型：" + details);
        }

        try {
            String payload = objectMapper.writeValueAsString(request);
            Request httpRequest = new Request.Builder()
                    .url(ragServiceUrl + "/admin/providers/delete")
                    .post(RequestBody.create(payload, JSON))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) {
                    throw new IOException("ai-service provider delete failed: " + response.code());
                }
            }
        } catch (Exception exception) {
            throw new IllegalArgumentException("删除模型提供方配置失败", exception);
        }
    }

    @Transactional(readOnly = true)
    public AdminProviderDocDto getProviderDoc(String provider) {
        String normalizedProvider = normalize(provider, "");
        String fileName = PROVIDER_DOC_FILES.get(normalizedProvider);
        if (fileName == null) {
            throw new IllegalArgumentException("未找到该提供方的模型说明文档");
        }

        Path filePath = AI_SERVICE_ROOT.resolve(fileName);
        if (!Files.exists(filePath)) {
            throw new IllegalArgumentException("模型说明文档不存在：" + fileName);
        }

        try {
            return new AdminProviderDocDto(
                    normalizedProvider,
                    fileName,
                    Files.readString(filePath)
            );
        } catch (IOException exception) {
            throw new IllegalArgumentException("读取模型说明文档失败", exception);
        }
    }

    @Transactional(readOnly = true)
    public AdminModelTestResponseDto testModel(AdminModelTestRequestDto request) {
        ModelCategory category = normalizeCategory(request.getCategory());
        String modelId = normalize(request.getModelId(), "");
        if (modelId.isBlank()) {
            throw new IllegalArgumentException("待测试模型不能为空");
        }

        AdminModelConfig item = adminModelConfigRepository.findByCategoryAndModelIdIgnoreCase(category, modelId)
                .orElseThrow(() -> new IllegalArgumentException("未找到对应模型，请先添加到候选列表"));

        try {
            String payload = objectMapper.writeValueAsString(new AiModelTestRequest(item.getProvider(), toCategoryKey(category), item.getModelId()));
            Request httpRequest = new Request.Builder()
                    .url(ragServiceUrl + "/admin/model-test")
                    .post(RequestBody.create(payload, JSON))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) {
                    String errorBody = response.body() != null ? response.body().string() : "";
                    throw new IllegalArgumentException(extractAiServiceErrorMessage(errorBody, "模型测试失败"));
                }
                if (response.body() == null) {
                    throw new IOException("ai-service model test returned empty body");
                }
                return objectMapper.readValue(response.body().string(), AdminModelTestResponseDto.class);
            }
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("模型测试失败，请检查 ai-service 配置和 provider 凭证", exception);
        }
    }

    public RagPromptConfigDto getRagPrompt() {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/admin/rag/prompt")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("ai-service prompt get failed: " + response.code());
            }
            return objectMapper.readValue(response.body().string(), RagPromptConfigDto.class);
        } catch (Exception exception) {
            throw new IllegalArgumentException("读取 RAG Prompt 配置失败", exception);
        }
    }

    public RagPromptConfigDto updateRagPrompt(RagPromptConfigDto request) {
        try {
            String payload = objectMapper.writeValueAsString(request);
            Request httpRequest = new Request.Builder()
                    .url(ragServiceUrl + "/admin/rag/prompt")
                    .put(RequestBody.create(payload, JSON))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    throw new IOException("ai-service prompt update failed: " + response.code());
                }
                return objectMapper.readValue(response.body().string(), RagPromptConfigDto.class);
            }
        } catch (Exception exception) {
            throw new IllegalArgumentException("保存 RAG Prompt 配置失败", exception);
        }
    }

    public List<RagPromptConfigDto> listRagPrompts() {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/admin/rag/prompts")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("ai-service prompt versions get failed: " + response.code());
            }
            return objectMapper.readValue(response.body().string(), new TypeReference<>() {});
        } catch (Exception exception) {
            throw new IllegalArgumentException("读取 RAG Prompt 版本失败", exception);
        }
    }

    public RagPromptConfigDto publishRagPrompt(String version) {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/admin/rag/prompts/" + version + "/publish")
                .post(RequestBody.create(new byte[0], null))
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("ai-service prompt publish failed: " + response.code());
            }
            return objectMapper.readValue(response.body().string(), RagPromptConfigDto.class);
        } catch (Exception exception) {
            throw new IllegalArgumentException("发布 RAG Prompt 失败", exception);
        }
    }

    public RagRetrievalConfigDto getRagRetrievalConfig() {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/admin/rag/retrieval-config")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("ai-service retrieval config get failed: " + response.code());
            }
            return objectMapper.readValue(response.body().string(), RagRetrievalConfigDto.class);
        } catch (Exception exception) {
            throw new IllegalArgumentException("读取 RAG 检索配置失败", exception);
        }
    }

    public RagRetrievalConfigDto updateRagRetrievalConfig(RagRetrievalConfigDto request) {
        try {
            String payload = objectMapper.writeValueAsString(request);
            Request httpRequest = new Request.Builder()
                    .url(ragServiceUrl + "/admin/rag/retrieval-config")
                    .put(RequestBody.create(payload, JSON))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    throw new IOException("ai-service retrieval config update failed: " + response.code());
                }
                return objectMapper.readValue(response.body().string(), RagRetrievalConfigDto.class);
            }
        } catch (Exception exception) {
            throw new IllegalArgumentException("保存 RAG 检索配置失败", exception);
        }
    }

    public RagLlmConfigDto getRagLlmConfig() {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/admin/rag/llm-config")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("ai-service llm config get failed: " + response.code());
            }
            return objectMapper.readValue(response.body().string(), RagLlmConfigDto.class);
        } catch (Exception exception) {
            throw new IllegalArgumentException("读取 LLM 运行配置失败", exception);
        }
    }

    public RagLlmConfigDto updateRagLlmConfig(RagLlmConfigDto request) {
        String provider = normalize(request.getProvider(), "");
        String model = normalize(request.getModel(), "");
        int timeoutSeconds = request.getTimeoutSeconds();
        if (provider.isBlank() || model.isBlank()) {
            throw new IllegalArgumentException("provider/model 不能为空");
        }
        if (timeoutSeconds < 1 || timeoutSeconds > 600) {
            throw new IllegalArgumentException("timeoutSeconds 必须在 1-600 之间");
        }

        try {
            String payload = objectMapper.writeValueAsString(request);
            Request httpRequest = new Request.Builder()
                    .url(ragServiceUrl + "/admin/rag/llm-config")
                    .put(RequestBody.create(payload, JSON))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    String errorBody = response.body() != null ? response.body().string() : "";
                    throw new IllegalArgumentException(extractAiServiceErrorMessage(errorBody, "保存 LLM 运行配置失败"));
                }
                return objectMapper.readValue(response.body().string(), RagLlmConfigDto.class);
            }
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("保存 LLM 运行配置失败", exception);
        }
    }

    public AgentModelBindingPayloadDto getAgentModelBindings() {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/agents/model-bindings")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("ai-service agent model bindings get failed: " + response.code());
            }
            return objectMapper.readValue(response.body().string(), AgentModelBindingPayloadDto.class);
        } catch (Exception exception) {
            throw new IllegalArgumentException("读取智能体模型编排配置失败", exception);
        }
    }

    public AgentModelBindingPayloadDto updateAgentModelBindings(AgentModelBindingPayloadDto request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("智能体模型编排不能为空");
        }
        for (AgentModelBindingItemDto item : request.getItems()) {
            validateAgentBindingModel(item);
        }

        try {
            String payload = objectMapper.writeValueAsString(request);
            Request httpRequest = new Request.Builder()
                    .url(ragServiceUrl + "/agents/model-bindings")
                    .put(RequestBody.create(payload, JSON))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    String errorBody = response.body() != null ? response.body().string() : "";
                    throw new IllegalArgumentException(extractAiServiceErrorMessage(errorBody, "保存智能体模型编排失败"));
                }
                return objectMapper.readValue(response.body().string(), AgentModelBindingPayloadDto.class);
            }
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("保存智能体模型编排失败", exception);
        }
    }

    public AgentCatalogResponseDto getAgentCatalog() {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/agents/health")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("ai-service agents health get failed: " + response.code());
            }
            return objectMapper.readValue(response.body().string(), AgentCatalogResponseDto.class);
        } catch (Exception exception) {
            return scanLocalAgentCatalog();
        }
    }

    public JsonNode getAiServiceHealth() {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/health")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (response.body() == null) {
                return objectMapper.readTree("{\"status\":\"degraded\",\"message\":\"ai-service health returned empty body\"}");
            }
            String body = response.body().string();
            if (body == null || body.isBlank()) {
                return objectMapper.readTree("{\"status\":\"degraded\",\"message\":\"ai-service health returned blank body\"}");
            }
            try {
                JsonNode parsed = objectMapper.readTree(body);
                if (parsed != null && !parsed.isNull()) {
                    return parsed;
                }
            } catch (Exception ignored) {
                // Fallback to wrapped text payload below.
            }
            String escaped = body
                    .replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r");
            int code = response.code();
            return objectMapper.readTree(
                    "{\"status\":\"degraded\",\"httpStatus\":" + code + ",\"message\":\"ai-service health returned non-json body\",\"raw\":\"" + escaped + "\"}"
            );
        } catch (Exception exception) {
            try {
                String escaped = String.valueOf(exception.getMessage())
                        .replace("\\", "\\\\")
                        .replace("\"", "\\\"")
                        .replace("\n", "\\n")
                        .replace("\r", "\\r");
                return objectMapper.readTree(
                        "{\"status\":\"down\",\"message\":\"读取 ai-service 健康状态失败\",\"error\":\"" + escaped + "\"}"
                );
            } catch (Exception secondary) {
                throw new IllegalArgumentException("读取 ai-service 健康状态失败", exception);
            }
        }
    }

    @Transactional
    public void seedDefaultsIfMissing() {
        // 模型候选列表改为完全手动维护，初始化时不再预置任何模型。
    }

    private List<AdminModelOptionDto> toOptionDtos(ModelCategory category) {
        return adminModelConfigRepository.findByCategoryOrderByProviderAscModelIdAsc(category).stream()
                .map(item -> new AdminModelOptionDto(toCategoryKey(item.getCategory()), item.getProvider(), item.getModelId()))
                .toList();
    }

    private String getSelectedModelId(ModelCategory category, String fallback) {
        return adminModelConfigRepository.findByCategoryOrderByProviderAscModelIdAsc(category).stream()
                .filter(AdminModelConfig::isSelected)
                .map(AdminModelConfig::getModelId)
                .findFirst()
                .orElse(fallback);
    }

    private void updateSelectedModel(ModelCategory category, String modelId) {
        if (modelId.isBlank()) {
            clearSelectedModel(category);
            return;
        }

        List<AdminModelConfig> items = adminModelConfigRepository.findByCategoryOrderByProviderAscModelIdAsc(category);
        AdminModelConfig selectedItem = items.stream()
                .filter(item -> item.getModelId().equalsIgnoreCase(modelId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("请先在候选列表中添加该模型，再选择启用"));

        items.forEach(item -> item.setSelected(item.getId().equals(selectedItem.getId())));
        selectedItem.setSelected(true);
        adminModelConfigRepository.saveAll(items);
        adminModelConfigRepository.save(selectedItem);
    }

    private void clearSelectedModel(ModelCategory category) {
        List<AdminModelConfig> items = adminModelConfigRepository.findByCategoryOrderByProviderAscModelIdAsc(category);
        items.forEach(item -> item.setSelected(false));
        adminModelConfigRepository.saveAll(items);
    }

    private ModelCategory normalizeCategory(String category) {
        if (category == null || category.isBlank()) {
            return ModelCategory.MULTIMODAL;
        }

        return switch (category.trim().toLowerCase()) {
            case "embedding" -> ModelCategory.EMBEDDING;
            case "speech" -> ModelCategory.SPEECH;
            case "vision" -> ModelCategory.VISION;
            case "chat" -> ModelCategory.CHAT;
            default -> ModelCategory.MULTIMODAL;
        };
    }

    private String toCategoryKey(ModelCategory category) {
        return switch (category) {
            case EMBEDDING -> "embedding";
            case SPEECH -> "speech";
            case VISION -> "vision";
            case CHAT -> "chat";
            case MULTIMODAL -> "multimodal";
        };
    }

    private String normalize(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    private String extractAiServiceErrorMessage(String responseBody, String fallback) {
        if (responseBody == null || responseBody.isBlank()) {
            return fallback;
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = objectMapper.readValue(responseBody, Map.class);
            Object detail = payload.get("detail");
            if (detail != null) {
                return String.valueOf(detail);
            }
            Object message = payload.get("message");
            if (message != null) {
                return String.valueOf(message);
            }
        } catch (Exception ignored) {
            // Fall back to raw body below.
        }
        return responseBody;
    }

    private void ensureProviderConfigured(String provider) {
        if (getProviderConfigs().stream().noneMatch(item -> provider.equalsIgnoreCase(item.getProvider()))) {
            throw new IllegalArgumentException("请先配置该模型提供方的 Base URL 和 API Key，再添加模型");
        }
    }

    private void validateAgentBindingModel(AgentModelBindingItemDto item) {
        if (item == null) {
            throw new IllegalArgumentException("智能体模型配置项不能为空");
        }
        String agent = normalize(item.getAgent(), "");
        String categoryRaw = normalize(item.getCategory(), "");
        String provider = normalize(item.getProvider(), "");
        String model = normalize(item.getModel(), "");
        if (agent.isBlank() || categoryRaw.isBlank() || provider.isBlank() || model.isBlank()) {
            throw new IllegalArgumentException("智能体模型编排中存在空字段（agent/category/provider/model）");
        }
        ModelCategory category = normalizeCategory(categoryRaw);
        boolean matched = adminModelConfigRepository
                .findByCategoryAndProviderIgnoreCaseAndModelIdIgnoreCase(category, provider, model)
                .isPresent();
        if (!matched) {
            throw new IllegalArgumentException("智能体 " + agent + " 绑定模型未在手动维护中配置："
                    + categoryRaw + " / " + provider + " / " + model);
        }
        int timeout = item.getTimeoutSeconds();
        if (timeout < 1 || timeout > 600) {
            throw new IllegalArgumentException("智能体 " + agent + " 的 timeoutSeconds 必须在 1-600 之间");
        }
    }

    private AgentCatalogResponseDto scanLocalAgentCatalog() {
        Path agentsRoot = AI_SERVICE_ROOT.resolve("agents");
        List<AgentCatalogItemDto> items = new ArrayList<>();
        if (Files.isDirectory(agentsRoot)) {
            try (var stream = Files.list(agentsRoot)) {
                stream
                        .filter(Files::isDirectory)
                        .filter(path -> {
                            String name = path.getFileName().toString();
                            return name.endsWith("_agent");
                        })
                        .sorted((left, right) -> left.getFileName().toString().compareToIgnoreCase(right.getFileName().toString()))
                        .forEach(path -> {
                            String name = path.getFileName().toString();
                            Path skill = path.resolve("SKILL.md");
                            Path soul = path.resolve("SOUL.md");
                            Path agentPy = path.resolve("agent.py");
                            if (!Files.exists(skill) || !Files.exists(soul) || !Files.exists(agentPy)) {
                                return;
                            }
                            AgentCatalogItemDto dto = new AgentCatalogItemDto();
                            dto.setName(name);
                            dto.setSkill("agents/" + name + "/SKILL.md");
                            dto.setSoul("agents/" + name + "/SOUL.md");
                            dto.setCategoryHint(guessAgentCategory(name));
                            items.add(dto);
                        });
            } catch (Exception ignored) {
                // Return what we can.
            }
        }

        AgentCatalogResponseDto response = new AgentCatalogResponseDto();
        response.setStatus("ok");
        response.setAgents(items);
        return response;
    }

    private String guessAgentCategory(String agentName) {
        return switch (agentName) {
            case "travel_analytics_agent" -> "multimodal";
            default -> "chat";
        };
    }

    private record AiModelTestRequest(String provider, String category, String modelId) {
    }

}
