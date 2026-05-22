package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.AdminModelCatalogDto;
import com.digitalhuman.backend_java.dto.AdminModelOptionDto;
import com.digitalhuman.backend_java.dto.AdminModelSettingsDto;
import com.digitalhuman.backend_java.dto.AdminProviderConfigDto;
import com.digitalhuman.backend_java.dto.AdminSyncModelsRequestDto;
import com.digitalhuman.backend_java.dto.AdminSyncModelsResponseDto;
import com.digitalhuman.backend_java.model.AdminModelConfig;
import com.digitalhuman.backend_java.model.ModelCategory;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.MediaType;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminSettingsService {

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    @Value("${rag.service-url}")
    private String ragServiceUrl;

    private final AdminModelConfigRepository adminModelConfigRepository;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    public AdminSettingsService(
            AdminModelConfigRepository adminModelConfigRepository,
            ObjectMapper objectMapper) {
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
                getSelectedModelId(ModelCategory.EMBEDDING, "BAAI/bge-m3"),
                getSelectedModelId(ModelCategory.SPEECH, "zh-CN-XiaoxiaoNeural"),
                getSelectedModelId(ModelCategory.VISION, "Qwen/Qwen2.5-VL-7B-Instruct"),
                getSelectedModelId(ModelCategory.MULTIMODAL, "deepseek-v4-flash")
        );
    }

    @Transactional
    public AdminModelSettingsDto updateModelSettings(AdminModelSettingsDto request) {
        updateSelectedModel(ModelCategory.EMBEDDING, "Custom", normalize(request.getEmbeddingModel(), "BAAI/bge-m3"));
        updateSelectedModel(ModelCategory.SPEECH, "Custom", normalize(request.getSpeechModel(), "zh-CN-XiaoxiaoNeural"));
        updateSelectedModel(ModelCategory.VISION, "Custom", normalize(request.getVisionModel(), "Qwen/Qwen2.5-VL-7B-Instruct"));
        updateSelectedModel(ModelCategory.MULTIMODAL, "Custom", normalize(request.getMultimodalModel(), "deepseek-v4-flash"));
        return getModelSettings();
    }

    @Transactional(readOnly = true)
    public AdminModelCatalogDto getModelCatalog() {
        return new AdminModelCatalogDto(
                toOptionDtos(ModelCategory.EMBEDDING),
                toOptionDtos(ModelCategory.SPEECH),
                toOptionDtos(ModelCategory.VISION),
                toOptionDtos(ModelCategory.MULTIMODAL)
        );
    }

    @Transactional
    public AdminModelCatalogDto addModelOption(AdminModelOptionDto request) {
        ModelCategory category = normalizeCategory(request.getCategory());
        String modelId = normalize(request.getModelId(), "");
        if (modelId.isBlank()) {
            throw new IllegalArgumentException("模型 ID 不能为空");
        }

        adminModelConfigRepository.findByCategoryAndModelIdIgnoreCase(category, modelId)
                .orElseGet(() -> {
                    AdminModelConfig item = new AdminModelConfig();
                    item.setCategory(category);
                    item.setProvider(normalize(request.getProvider(), "Custom"));
                    item.setModelId(modelId);
                    item.setSelected(false);
                    return adminModelConfigRepository.save(item);
                });

        return getModelCatalog();
    }

    @Transactional(readOnly = true)
    public List<AdminProviderConfigDto> getProviderConfigs() {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/admin/providers")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("ai-service provider config request failed: " + response.code());
            }
            return objectMapper.readValue(response.body().string(), new TypeReference<>() {});
        } catch (Exception exception) {
            throw new IllegalArgumentException("AI 服务配置读取失败", exception);
        }
    }

    @Transactional
    public AdminProviderConfigDto saveProviderConfig(AdminProviderConfigDto request) {
        try {
            String payload = objectMapper.writeValueAsString(request);
            Request httpRequest = new Request.Builder()
                    .url(ragServiceUrl + "/admin/providers")
                    .put(RequestBody.create(payload, JSON))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    throw new IOException("ai-service provider config save failed: " + response.code());
                }
                return objectMapper.readValue(response.body().string(), AdminProviderConfigDto.class);
            }
        } catch (Exception exception) {
            throw new IllegalArgumentException("AI 服务配置保存失败", exception);
        }
    }

    @Transactional
    public AdminSyncModelsResponseDto syncProviderModels(AdminSyncModelsRequestDto request) {
        ModelCategory category = normalizeCategory(request.getCategory());
        AdminSyncModelsResponseDto syncResponse;
        try {
            String payload = objectMapper.writeValueAsString(request);
            Request httpRequest = new Request.Builder()
                    .url(ragServiceUrl + "/admin/providers/sync-models")
                    .post(RequestBody.create(payload, JSON))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    throw new IOException("ai-service sync models failed: " + response.code());
                }
                syncResponse = objectMapper.readValue(response.body().string(), AdminSyncModelsResponseDto.class);
            }
        } catch (Exception exception) {
            throw new IllegalArgumentException("AI 服务模型同步失败", exception);
        }

        List<String> modelIds = syncResponse.getModelIds();
        for (String modelId : modelIds) {
            adminModelConfigRepository.findByCategoryAndModelIdIgnoreCase(category, modelId)
                    .orElseGet(() -> {
                        AdminModelConfig item = new AdminModelConfig();
                        item.setCategory(category);
                        item.setProvider(syncResponse.getProvider());
                        item.setModelId(modelId);
                        item.setSelected(false);
                        return adminModelConfigRepository.save(item);
                    });
        }

        syncResponse.setCategory(toCategoryKey(category));
        return syncResponse;
    }

    @Transactional
    public void seedDefaultsIfMissing() {
        seedModel(ModelCategory.EMBEDDING, "BAAI", "BAAI/bge-m3", true);
        seedModel(ModelCategory.EMBEDDING, "BAAI", "BAAI/bge-large-zh-v1.5", false);
        seedModel(ModelCategory.EMBEDDING, "Qwen", "Qwen/Qwen3-Embedding-4B", false);
        seedModel(ModelCategory.EMBEDDING, "OpenAI", "text-embedding-3-large", false);

        seedModel(ModelCategory.SPEECH, "Azure", "zh-CN-XiaoxiaoNeural", true);
        seedModel(ModelCategory.SPEECH, "Azure", "zh-CN-YunxiNeural", false);
        seedModel(ModelCategory.SPEECH, "Azure", "zh-CN-YunjianNeural", false);
        seedModel(ModelCategory.SPEECH, "Azure", "en-US-JennyNeural", false);

        seedModel(ModelCategory.VISION, "Qwen", "Qwen/Qwen2.5-VL-7B-Instruct", true);
        seedModel(ModelCategory.VISION, "Qwen", "Qwen/Qwen2.5-VL-32B-Instruct", false);
        seedModel(ModelCategory.VISION, "OpenAI", "gpt-4.1-mini", false);
        seedModel(ModelCategory.VISION, "Google", "gemini-2.5-flash", false);

        seedModel(ModelCategory.MULTIMODAL, "DeepSeek", "deepseek-v4-flash", true);
        seedModel(ModelCategory.MULTIMODAL, "DeepSeek", "deepseek-v4-pro", false);
        seedModel(ModelCategory.MULTIMODAL, "Qwen", "Qwen/Qwen2.5-Omni-7B", false);
        seedModel(ModelCategory.MULTIMODAL, "OpenAI", "gpt-4.1", false);
        seedModel(ModelCategory.MULTIMODAL, "OpenAI", "gpt-4o", false);
        seedModel(ModelCategory.MULTIMODAL, "Google", "gemini-2.5-pro", false);

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

    private void seedModel(ModelCategory category, String provider, String modelId, boolean selected) {
        AdminModelConfig item = adminModelConfigRepository.findByCategoryAndModelIdIgnoreCase(category, modelId)
                .orElseGet(() -> {
                    AdminModelConfig next = new AdminModelConfig();
                    next.setCategory(category);
                    next.setProvider(provider);
                    next.setModelId(modelId);
                    next.setSelected(false);
                    return next;
                });

        item.setProvider(provider);
        if (selected && adminModelConfigRepository.findByCategoryOrderByProviderAscModelIdAsc(category).stream().noneMatch(AdminModelConfig::isSelected)) {
            item.setSelected(true);
        }
        adminModelConfigRepository.save(item);
    }

    private ModelCategory normalizeCategory(String category) {
        if (category == null || category.isBlank()) {
            return ModelCategory.MULTIMODAL;
        }

        return switch (category.trim().toLowerCase()) {
            case "embedding" -> ModelCategory.EMBEDDING;
            case "speech" -> ModelCategory.SPEECH;
            case "vision" -> ModelCategory.VISION;
            default -> ModelCategory.MULTIMODAL;
        };
    }

    private String toCategoryKey(ModelCategory category) {
        return switch (category) {
            case EMBEDDING -> "embedding";
            case SPEECH -> "speech";
            case VISION -> "vision";
            case MULTIMODAL -> "multimodal";
        };
    }

    private String normalize(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

}
