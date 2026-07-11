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
import com.digitalhuman.backend_java.dto.AgentHealthTestRequestDto;
import com.digitalhuman.backend_java.dto.AgentHealthTestResponseDto;
import com.digitalhuman.backend_java.dto.AgentModelBindingItemDto;
import com.digitalhuman.backend_java.dto.AgentModelBindingPayloadDto;
import com.digitalhuman.backend_java.model.AdminModelConfig;
import com.digitalhuman.backend_java.model.AdminProviderConfig;
import com.digitalhuman.backend_java.model.ModelCategory;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.digitalhuman.backend_java.repository.AdminProviderConfigRepository;
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
import okhttp3.MultipartBody;
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
    private static final String MASKED_API_KEY = "********";
    private static final Path PROJECT_ROOT = Path.of("").toAbsolutePath().getParent();
    private static final Path AI_SERVICE_ROOT = PROJECT_ROOT.resolve("ai-service");
    private static final Map<String, String> PROVIDER_DOC_FILES = Map.of(
            "DeepSeek", "model_providers/deepseek/docs/models.md",
            "Qwen", "model_providers/qwen/docs/models.md",
            "Volcengine", "model_providers/volcengine/docs/models.md",
            "Xunfei", "model_providers/xunfei/docs/models.md",
            "Local TTS", "model_providers/local_tts/docs/models.md"
    );

    @Value("${ai.service-url}")
    private String aiServiceUrl;

    private final AdminModelConfigRepository adminModelConfigRepository;
    private final AdminProviderConfigRepository adminProviderConfigRepository;
    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;

    public AdminSettingsService(AdminModelConfigRepository adminModelConfigRepository,
                                AdminProviderConfigRepository adminProviderConfigRepository,
                                ObjectMapper objectMapper) {
        this.adminModelConfigRepository = adminModelConfigRepository;
        this.adminProviderConfigRepository = adminProviderConfigRepository;
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
        return adminProviderConfigRepository.findAllByOrderByProviderAsc().stream()
                .map(item -> {
                    AdminProviderConfigDto dto = new AdminProviderConfigDto();
                    dto.setProvider(item.getProvider());
                    dto.setBaseUrl(item.getBaseUrl());
                    dto.setApiKey(maskApiKey(item.getApiKey()));
                    dto.setProtocol(item.getProtocol());
                    return dto;
                })
                .toList();
    }

    @Transactional
    public AdminProviderConfigDto saveProviderConfig(AdminProviderConfigDto request) {
        String provider = normalize(request.getProvider(), "");
        String baseUrl = normalize(request.getBaseUrl(), "");
        String requestedApiKey = normalize(request.getApiKey(), "");
        String protocol = normalize(request.getProtocol(), "openai_compatible");
        if (provider.isBlank() || baseUrl.isBlank()) {
            throw new IllegalArgumentException("提供方和 Base URL 不能为空");
        }

        // 1) 写入 Java MySQL
        AdminProviderConfig entity = adminProviderConfigRepository.findByProviderIgnoreCase(provider)
                .orElseGet(AdminProviderConfig::new);
        String apiKey = isMaskedApiKey(requestedApiKey) || requestedApiKey.isBlank()
                ? normalize(entity.getApiKey(), "")
                : requestedApiKey;
        if (apiKey.isBlank()) {
            throw new IllegalArgumentException("API Key 不能为空");
        }
        entity.setProvider(provider);
        entity.setBaseUrl(baseUrl);
        entity.setApiKey(apiKey);
        entity.setProtocol(protocol);
        adminProviderConfigRepository.save(entity);

        // 2) 同步到 ai-service（兼容智能体运行时仍从 SQLite 读取的场景）
        try {
            AdminProviderConfigDto payloadDto = new AdminProviderConfigDto();
            payloadDto.setProvider(provider);
            payloadDto.setBaseUrl(baseUrl);
            payloadDto.setApiKey(apiKey);
            payloadDto.setProtocol(protocol);
            String payload = objectMapper.writeValueAsString(payloadDto);
            Request httpRequest = new Request.Builder()
                    .url(aiServiceUrl + "/admin/providers")
                    .put(RequestBody.create(payload, JSON))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                // 同步失败不阻断主流程，仅记录日志
                if (!response.isSuccessful()) {
                    System.err.println("[WARN] 同步 provider 到 ai-service 失败，code=" + response.code());
                }
            }
        } catch (Exception syncEx) {
            System.err.println("[WARN] 同步 provider 到 ai-service 异常：" + syncEx.getMessage());
        }

        AdminProviderConfigDto result = new AdminProviderConfigDto();
        result.setProvider(provider);
        result.setBaseUrl(baseUrl);
        result.setApiKey(maskApiKey(apiKey));
        result.setProtocol(protocol);
        return result;
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

        // 1) 删除 Java MySQL 中的记录
        adminProviderConfigRepository.findByProviderIgnoreCase(provider)
                .ifPresent(adminProviderConfigRepository::delete);

        // 2) 同步删除 ai-service 中的记录
        try {
            String payload = objectMapper.writeValueAsString(request);
            Request httpRequest = new Request.Builder()
                    .url(aiServiceUrl + "/admin/providers/delete")
                    .post(RequestBody.create(payload, JSON))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) {
                    System.err.println("[WARN] 同步删除 provider 到 ai-service 失败，code=" + response.code());
                }
            }
        } catch (Exception syncEx) {
            System.err.println("[WARN] 同步删除 provider 到 ai-service 异常：" + syncEx.getMessage());
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
            return buildTestErrorResponse("", request.getCategory(), "", "待测试模型不能为空");
        }

        AdminModelConfig item = adminModelConfigRepository.findByCategoryAndModelIdIgnoreCase(category, modelId)
                .orElse(null);
        if (item == null) {
            return buildTestErrorResponse("", request.getCategory(), modelId,
                    "未找到对应模型「" + modelId + "」，请先保存配置并添加到候选列表");
        }

        String provider = item.getProvider();
        String categoryKey = toCategoryKey(category);

        // 从 Java MySQL 读取 provider 凭证
        AdminProviderConfig providerConfig = adminProviderConfigRepository.findByProviderIgnoreCase(provider).orElse(null);
        String baseUrl = providerConfig != null ? providerConfig.getBaseUrl() : "";
        String apiKey = providerConfig != null ? providerConfig.getApiKey() : "";

        if (baseUrl.isBlank() || apiKey.isBlank()) {
            return buildTestErrorResponse(provider, categoryKey, item.getModelId(),
                    "请先在「模型配置」中配置 " + provider + " 的 Base URL 和 API Key");
        }

        try {
            String payload = objectMapper.writeValueAsString(new AiModelTestRequest(
                    provider, categoryKey, item.getModelId(),
                    request.getText(), request.getImageDataUrl(), request.getMode(),
                    baseUrl, apiKey
            ));
            Request httpRequest = new Request.Builder()
                    .url(aiServiceUrl + "/admin/model-test")
                    .post(RequestBody.create(payload, JSON))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    String detail = sanitizeSecret(extractAiServiceErrorMessage(responseBody, "模型测试失败"), apiKey);
                    return buildTestErrorResponse(provider, categoryKey, item.getModelId(), detail);
                }
                return objectMapper.readValue(responseBody, AdminModelTestResponseDto.class);
            }
        } catch (IOException exception) {
            return buildTestErrorResponse(provider, categoryKey, item.getModelId(),
                    sanitizeSecret("无法连接 ai-service：" + exception.getMessage(), apiKey));
        } catch (Exception exception) {
            return buildTestErrorResponse(provider, categoryKey, item.getModelId(),
                    sanitizeSecret("模型测试异常：" + exception.getMessage(), apiKey));
        }
    }

    private AdminModelTestResponseDto buildTestErrorResponse(String provider, String category, String modelId, String detail) {
        AdminModelTestResponseDto dto = new AdminModelTestResponseDto();
        dto.setSuccess(false);
        dto.setProvider(provider);
        dto.setCategory(category);
        dto.setModelId(modelId);
        dto.setMessage("模型测试失败");
        dto.setDetail(detail);
        return dto;
    }

    private String maskApiKey(String apiKey) {
        return normalize(apiKey, "").isBlank() ? "" : MASKED_API_KEY;
    }

    private boolean isMaskedApiKey(String apiKey) {
        return MASKED_API_KEY.equals(apiKey) || apiKey.matches("^[*•]+$");
    }

    private String sanitizeSecret(String detail, String apiKey) {
        String safeDetail = normalize(detail, "模型测试失败");
        return apiKey == null || apiKey.isBlank() ? safeDetail : safeDetail.replace(apiKey, MASKED_API_KEY);
    }

    public AgentModelBindingPayloadDto getAgentModelBindings() {
        Request request = new Request.Builder()
                .url(aiServiceUrl + "/agents/model-bindings")
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
                    .url(aiServiceUrl + "/agents/model-bindings")
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
                .url(aiServiceUrl + "/agents/health")
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

    public AgentHealthTestResponseDto testAgent(AgentHealthTestRequestDto request) {
        String agent = normalize(request.getAgent(), "");
        String task = normalize(request.getTask(), "");
        if (agent.isBlank()) {
            throw new IllegalArgumentException("agent 不能为空");
        }
        if (task.isBlank()) {
            throw new IllegalArgumentException("task 不能为空");
        }

        RequestBody formBody = new MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("agent", agent)
                .addFormDataPart("task", task)
                .build();
        Request runtimeRequest = new Request.Builder()
                .url(aiServiceUrl + "/agents/runtime-test")
                .post(formBody)
                .build();

        try (Response response = httpClient.newCall(runtimeRequest).execute()) {
            String responseBody = response.body() == null ? "" : response.body().string();
            if (!response.isSuccessful()) {
                throw new IllegalArgumentException(extractAiServiceErrorMessage(responseBody, "智能体任务测试失败: HTTP " + response.code()));
            }
            if (responseBody.isBlank()) {
                throw new IOException("智能体任务测试返回空响应");
            }
            JsonNode payload = objectMapper.readTree(responseBody);
            AgentHealthTestResponseDto result = new AgentHealthTestResponseDto();
            result.setAgent(payload.path("agent").asText(agent));
            result.setSuccess(payload.path("success").asBoolean(true));
            result.setMessage("智能体任务执行成功");
            result.setDetail("已通过绑定模型执行任务");
            result.setProvider(payload.path("provider").asText(""));
            result.setModel(payload.path("model").asText(""));
            result.setResult(payload.path("result").asText(""));
            return result;
        } catch (Exception exception) {
            AgentHealthTestResponseDto result = new AgentHealthTestResponseDto();
            result.setAgent(agent);
            result.setSuccess(false);
            result.setMessage("智能体任务测试失败");
            result.setDetail(String.valueOf(exception.getMessage()));
            return result;
        }
    }

    public JsonNode getAiServiceHealth() {
        Request request = new Request.Builder()
                .url(aiServiceUrl + "/health")
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
        if (adminProviderConfigRepository.findByProviderIgnoreCase(provider).isEmpty()) {
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
                            dto.setDisplayName(toAgentDisplayName(name));
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

    private String toAgentDisplayName(String agentName) {
        return switch (agentName) {
            case "leader_agent" -> "总控对话智能体";
            case "travel_analytics_agent" -> "旅游行为数据编排智能体";
            case "scenic_structured_agent" -> "景点结构化数据智能体";
            case "guide_script_agent" -> "口播脚本生成智能体";
            default -> agentName;
        };
    }

    private record AiModelTestRequest(String provider, String category, String modelId, String text, String imageDataUrl, String mode, String baseUrl, String apiKey) {
    }

}
