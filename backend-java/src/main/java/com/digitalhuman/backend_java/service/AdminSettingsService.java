package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.AdminModelCatalogDto;
import com.digitalhuman.backend_java.dto.AdminModelOptionDto;
import com.digitalhuman.backend_java.dto.AdminProviderDocDto;
import com.digitalhuman.backend_java.dto.AdminProviderConfigDto;
import com.digitalhuman.backend_java.dto.AdminModelSettingsDto;
import com.digitalhuman.backend_java.dto.AdminModelTestRequestDto;
import com.digitalhuman.backend_java.dto.AdminModelTestResponseDto;
import com.digitalhuman.backend_java.model.AdminModelConfig;
import com.digitalhuman.backend_java.model.ModelCategory;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
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
            "OpenAI", "model_providers/openai/docs/models.md",
            "Qwen", "model_providers/qwen/docs/models.md",
            "Google", "model_providers/google/docs/models.md",
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
        updateSelectedModel(ModelCategory.EMBEDDING, "Custom", normalize(request.getEmbeddingModel(), ""));
        updateSelectedModel(ModelCategory.SPEECH, "Custom", normalize(request.getSpeechModel(), ""));
        updateSelectedModel(ModelCategory.VISION, "Custom", normalize(request.getVisionModel(), ""));
        updateSelectedModel(ModelCategory.CHAT, "Custom", normalize(request.getChatModel(), ""));
        updateSelectedModel(ModelCategory.MULTIMODAL, "Custom", normalize(request.getMultimodalModel(), ""));
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

        updateSelectedModel(category, provider, modelId);
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

    private void updateSelectedModel(ModelCategory category, String fallbackProvider, String modelId) {
        if (modelId.isBlank()) {
            clearSelectedModel(category);
            return;
        }

        List<AdminModelConfig> items = adminModelConfigRepository.findByCategoryOrderByProviderAscModelIdAsc(category);
        AdminModelConfig selectedItem = items.stream()
                .filter(item -> item.getModelId().equalsIgnoreCase(modelId))
                .findFirst()
                .orElseGet(() -> {
                    AdminModelConfig item = new AdminModelConfig();
                    item.setCategory(category);
                    item.setProvider(fallbackProvider);
                    item.setModelId(modelId);
                    item.setSelected(false);
                    return adminModelConfigRepository.save(item);
                });

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

    private record AiModelTestRequest(String provider, String category, String modelId) {
    }

}
