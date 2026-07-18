package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.VoiceScriptGenerateRequest;
import com.digitalhuman.backend_java.model.AdminModelConfig;
import com.digitalhuman.backend_java.model.AdminProviderConfig;
import com.digitalhuman.backend_java.model.ModelCategory;
import com.digitalhuman.backend_java.model.ScenicStructuredSpotRecord;
import com.digitalhuman.backend_java.model.VoiceScriptScene;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.digitalhuman.backend_java.repository.AdminProviderConfigRepository;
import com.digitalhuman.backend_java.repository.ScenicStructuredSpotRecordRepository;
import com.digitalhuman.backend_java.repository.VoiceScriptSceneRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
public class VoiceScriptGenerationService {

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final Set<String> ALLOWED_STYLES = Set.of("culture", "family", "light");

    private final MaxKbKnowledgeService maxKbKnowledgeService;
    private final ScenicStructuredSpotRecordRepository scenicRepository;
    private final VoiceScriptSceneRepository voiceRepository;
    private final AdminModelConfigRepository modelConfigRepository;
    private final AdminProviderConfigRepository providerConfigRepository;
    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;
    private final String aiServiceUrl;
    private final AiChatGateway aiChatGateway;

    @Autowired
    public VoiceScriptGenerationService(
            MaxKbKnowledgeService maxKbKnowledgeService,
            ScenicStructuredSpotRecordRepository scenicRepository,
            VoiceScriptSceneRepository voiceRepository,
            AdminModelConfigRepository modelConfigRepository,
            AdminProviderConfigRepository providerConfigRepository,
            ObjectMapper objectMapper,
            @Value("${ai.service-url}") String aiServiceUrl) {
        this.maxKbKnowledgeService = maxKbKnowledgeService;
        this.scenicRepository = scenicRepository;
        this.voiceRepository = voiceRepository;
        this.modelConfigRepository = modelConfigRepository;
        this.providerConfigRepository = providerConfigRepository;
        this.objectMapper = objectMapper;
        this.aiServiceUrl = stripTrailingSlash(aiServiceUrl);
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(90, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
        this.aiChatGateway = this::callBasicChat;
    }

    VoiceScriptGenerationService(
            MaxKbKnowledgeService maxKbKnowledgeService,
            ScenicStructuredSpotRecordRepository scenicRepository,
            VoiceScriptSceneRepository voiceRepository,
            ObjectMapper objectMapper,
            AiChatGateway aiChatGateway) {
        this.maxKbKnowledgeService = maxKbKnowledgeService;
        this.scenicRepository = scenicRepository;
        this.voiceRepository = voiceRepository;
        this.modelConfigRepository = null;
        this.providerConfigRepository = null;
        this.objectMapper = objectMapper;
        this.aiServiceUrl = "";
        this.httpClient = null;
        this.aiChatGateway = aiChatGateway;
    }

    @Transactional
    public VoiceScriptScene generate(VoiceScriptGenerateRequest request) {
        String spotId = normalize(request.getSpotId());
        String style = normalize(request.getStyle()).toLowerCase(Locale.ROOT);
        if (spotId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "景点ID不能为空");
        }
        if (!ALLOWED_STYLES.contains(style)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "style 仅支持 culture/family/light");
        }
        int targetDuration = request.getTargetDurationSec() == null ? 60 : request.getTargetDurationSec();
        if (targetDuration < 20 || targetDuration > 300) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "目标时长必须在20到300秒之间");
        }

        ScenicStructuredSpotRecord spot = scenicRepository.findBySpot_idIgnoreCase(spotId).orElse(null);
        Map<String, Object> scenicSource = scenicSnapshot(spot);
        List<Map<String, Object>> sourceSnapshots = retrieveSources(request, spot);
        boolean hasKnowledgeContent = sourceSnapshots.stream().anyMatch(this::hasSuccessfulHits);
        if (scenicSource.isEmpty() && !hasKnowledgeContent) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "景点主数据和所选知识来源均无有效内容");
        }

        Map<String, Object> aiPayload = new LinkedHashMap<>();
        aiPayload.put("message", buildUserMessage(spotId, scenicSource, sourceSnapshots, request.getAdditionalRequirements()));
        aiPayload.put("history", List.of());
        aiPayload.put("systemPrompt", buildSystemPrompt(targetDuration, style));

        String scriptText;
        try {
            scriptText = normalize(aiChatGateway.generate(aiPayload));
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI口播生成失败：" + exception.getMessage(), exception);
        }
        if (scriptText.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI未返回有效口播内容");
        }

        int nextVersion = voiceRepository.findTopBySpotIdAndSceneTypeAndStyleOrderByVersionNoDesc(spotId, "spot", style)
                .map(VoiceScriptScene::getVersionNo)
                .orElse(0) + 1;
        VoiceScriptScene scene = new VoiceScriptScene();
        scene.setScenicName(spot == null ? "" : normalize(spot.getScenic_name()));
        scene.setSpotId(spotId);
        scene.setSpotName(spot == null ? spotId : defaultIfBlank(spot.getSpot_name(), spotId));
        scene.setSceneType("spot");
        scene.setStyle(style);
        scene.setTitle(scene.getSpotName() + "讲解");
        scene.setScriptText(scriptText);
        scene.setSsmlText(toSimpleSsml(scriptText));
        scene.setDurationSec(estimateDurationSec(scriptText));
        scene.setTargetDurationSec(targetDuration);
        scene.setVersionNo(nextVersion);
        scene.setStatus("draft");
        scene.setGenerationMode("ai");
        scene.setAudioStatus("missing");
        scene.setSourceFile("AI知识库生成");
        scene.setSourceRefsJson(writeSourceSnapshot(request.getAccountId(), scenicSource, sourceSnapshots));
        return voiceRepository.save(scene);
    }

    private List<Map<String, Object>> retrieveSources(VoiceScriptGenerateRequest request, ScenicStructuredSpotRecord spot) {
        List<Map<String, Object>> snapshots = new ArrayList<>();
        List<VoiceScriptGenerateRequest.KnowledgeSource> knowledgeSources = request.getKnowledgeSources() == null
                ? List.of()
                : request.getKnowledgeSources();
        String query = spot == null
                ? request.getSpotId() + " 景点介绍 文化内涵 游玩亮点"
                : defaultIfBlank(spot.getSpot_name(), request.getSpotId()) + " 景点介绍 文化内涵 游玩亮点";

        for (VoiceScriptGenerateRequest.KnowledgeSource source : knowledgeSources) {
            String knowledgeId = normalize(source.getKnowledgeId());
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("knowledgeId", knowledgeId);
            snapshot.put("knowledgeName", normalize(source.getKnowledgeName()));
            List<String> selectedDocumentIds = normalizedIds(source.getDocumentIds());
            snapshot.put("selectedDocumentIds", selectedDocumentIds);
            try {
                Map<String, Object> hitRequest = new LinkedHashMap<>();
                hitRequest.put("knowledge_id", knowledgeId);
                hitRequest.put("query_text", query);
                hitRequest.put("top_number", 10);
                hitRequest.put("similarity", 0.2);
                hitRequest.put("search_mode", "blend");
                Object response = maxKbKnowledgeService.hitTest(request.getAccountId(), hitRequest);
                List<Map<String, Object>> hits = extractHits(response).stream()
                        .filter(hit -> selectedDocumentIds.isEmpty()
                                || selectedDocumentIds.contains(text(hit, "document_id", "documentId")))
                        .filter(hit -> !text(hit, "content", "text", "paragraph_content").isBlank())
                        .map(this::sourceHitSnapshot)
                        .toList();
                snapshot.put("status", "success");
                snapshot.put("hits", hits);
            } catch (Exception exception) {
                snapshot.put("status", "failed");
                snapshot.put("error", normalize(exception.getMessage()));
                snapshot.put("hits", List.of());
            }
            snapshots.add(snapshot);
        }
        return snapshots;
    }

    private List<Map<String, Object>> extractHits(Object response) {
        JsonNode root = objectMapper.valueToTree(response);
        JsonNode rows = findArray(root);
        if (rows == null) {
            return List.of();
        }
        List<Map<String, Object>> hits = new ArrayList<>();
        for (JsonNode row : rows) {
            if (row.isObject()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> mapped = objectMapper.convertValue(row, Map.class);
                hits.add(mapped);
            }
        }
        return hits;
    }

    private JsonNode findArray(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isArray()) {
            return node;
        }
        for (String key : List.of("data", "records", "items", "list")) {
            JsonNode child = node.path(key);
            JsonNode found = findArray(child);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    private Map<String, Object> sourceHitSnapshot(Map<String, Object> hit) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("paragraphId", text(hit, "id", "paragraph_id", "paragraphId"));
        snapshot.put("documentId", text(hit, "document_id", "documentId"));
        snapshot.put("documentName", text(hit, "document_name", "documentName", "title"));
        snapshot.put("content", text(hit, "content", "text", "paragraph_content"));
        Object similarity = first(hit, "similarity", "comprehensive_score");
        if (similarity != null) {
            snapshot.put("similarity", similarity);
        }
        return snapshot;
    }

    private Map<String, Object> scenicSnapshot(ScenicStructuredSpotRecord spot) {
        if (spot == null) {
            return Map.of();
        }
        Map<String, Object> snapshot = new LinkedHashMap<>();
        putNonBlank(snapshot, "scenicName", spot.getScenic_name());
        putNonBlank(snapshot, "spotId", spot.getSpot_id());
        putNonBlank(snapshot, "spotName", spot.getSpot_name());
        putNonBlank(snapshot, "location", spot.getLocation());
        putNonBlank(snapshot, "architectureLandscapeParams", spot.getArchitecture_landscape_params());
        putNonBlank(snapshot, "coreFunction", spot.getCore_function());
        putNonBlank(snapshot, "culturalConnotation", spot.getCultural_connotation());
        putNonBlank(snapshot, "detailedIntroduction", spot.getDetailed_introduction());
        putNonBlank(snapshot, "highlights", spot.getHighlights());
        putNonBlank(snapshot, "performanceOpenInfo", spot.getPerformance_open_info());
        putNonBlank(snapshot, "remark", spot.getRemark());
        return snapshot;
    }

    private String buildSystemPrompt(int targetDuration, String style) {
        int targetCharacters = targetDuration * 4;
        return "你是景区专业口播编辑。只能依据用户提供的景点主数据与知识库片段整理事实，禁止编造。"
                + "输出简体中文纯文本，不要标题、Markdown、来源标号、舞台动作或寒暄。"
                + "语言自然、适合直接语音播报，目标时长约" + targetDuration + "秒，约" + targetCharacters + "字。"
                + "当前风格：" + styleLabel(style) + "。";
    }

    private String buildUserMessage(
            String spotId,
            Map<String, Object> scenicSource,
            List<Map<String, Object>> sourceSnapshots,
            String additionalRequirements) {
        StringBuilder message = new StringBuilder("请为景点 ").append(spotId).append(" 生成口播。\n\n景点主数据：\n");
        appendMap(message, scenicSource);
        message.append("\n知识库召回片段：\n");
        int index = 1;
        for (Map<String, Object> source : sourceSnapshots) {
            Object hitsValue = source.get("hits");
            if (!(hitsValue instanceof List<?> hits)) {
                continue;
            }
            for (Object hitValue : hits) {
                if (!(hitValue instanceof Map<?, ?> hit)) {
                    continue;
                }
                message.append('[').append(index++).append("] ")
                        .append(normalize(String.valueOf(hit.get("documentName"))))
                        .append("：")
                        .append(normalize(String.valueOf(hit.get("content"))))
                        .append('\n');
            }
        }
        String requirements = normalize(additionalRequirements);
        if (!requirements.isBlank()) {
            message.append("\n补充要求：").append(requirements);
        }
        return message.toString();
    }

    private String writeSourceSnapshot(
            Long accountId,
            Map<String, Object> scenicSource,
            List<Map<String, Object>> knowledgeSources) {
        try {
            return objectMapper.writeValueAsString(Map.of(
                    "accountId", accountId,
                    "scenicStructuredData", scenicSource,
                    "knowledgeSources", knowledgeSources
            ));
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "保存口播来源快照失败", exception);
        }
    }

    private String callBasicChat(Map<String, Object> payload) throws Exception {
        payload.putAll(resolveAiModelConfig());
        Request request = new Request.Builder()
                .url(aiServiceUrl + "/agents/basic-chat")
                .post(RequestBody.create(objectMapper.writeValueAsString(payload), JSON))
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("Basic chat request failed: " + response.code());
            }
            JsonNode root = objectMapper.readTree(response.body().string());
            if (!root.path("success").asBoolean(false)) {
                throw new IOException("Basic chat returned unsuccessful response");
            }
            return normalize(root.path("output").path("answer").asText(""));
        }
    }

    private Map<String, String> resolveAiModelConfig() {
        AdminModelConfig model = modelConfigRepository.findFirstByCategoryAndSelectedTrue(ModelCategory.CHAT)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "未配置已启用的CHAT模型"));
        AdminProviderConfig provider = providerConfigRepository.findByProviderIgnoreCase(model.getProvider())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "CHAT模型Provider配置不存在"));
        Map<String, String> config = new LinkedHashMap<>();
        config.put("provider", model.getProvider());
        config.put("model", model.getModelId());
        config.put("baseUrl", provider.getBaseUrl());
        config.put("apiKey", provider.getApiKey());
        return config;
    }

    private boolean hasSuccessfulHits(Map<String, Object> source) {
        return "success".equals(source.get("status"))
                && source.get("hits") instanceof List<?> hits
                && !hits.isEmpty();
    }

    private void appendMap(StringBuilder target, Map<String, Object> values) {
        values.forEach((key, value) -> target.append(key).append("：").append(value).append('\n'));
    }

    private void putNonBlank(Map<String, Object> target, String key, String value) {
        String normalized = normalize(value);
        if (!normalized.isBlank()) {
            target.put(key, normalized);
        }
    }

    private List<String> normalizedIds(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return new ArrayList<>(values.stream()
                .map(this::normalize)
                .filter(value -> !value.isBlank())
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
    }

    private Object first(Map<String, Object> values, String... keys) {
        for (String key : keys) {
            Object value = values.get(key);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String text(Map<String, Object> values, String... keys) {
        Object value = first(values, keys);
        return value == null ? "" : normalize(String.valueOf(value));
    }

    private int estimateDurationSec(String text) {
        return Math.max(1, (int) Math.ceil(text.length() / 4.0));
    }

    private String toSimpleSsml(String text) {
        return "<speak>" + text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;") + "</speak>";
    }

    private String styleLabel(String style) {
        return switch (style) {
            case "family" -> "亲子友好";
            case "light" -> "轻松自然";
            default -> "文化讲解";
        };
    }

    private String defaultIfBlank(String value, String fallback) {
        String normalized = normalize(value);
        return normalized.isBlank() ? fallback : normalized;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static String stripTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    @FunctionalInterface
    interface AiChatGateway {
        String generate(Map<String, Object> payload) throws Exception;
    }
}
