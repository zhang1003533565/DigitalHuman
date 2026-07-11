package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.FeedbackRecordDto;
import com.digitalhuman.backend_java.dto.FeedbackRequest;
import com.digitalhuman.backend_java.dto.GuideChatRequest;
import com.digitalhuman.backend_java.dto.GuideChatResponse;
import com.digitalhuman.backend_java.dto.GuideMessageDto;
import com.digitalhuman.backend_java.dto.GuideSourceDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto.CoordinateDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto.RouteFacilityDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto.RouteNodeDto;
import com.digitalhuman.backend_java.dto.ScenicSpotDto;
import com.digitalhuman.backend_java.model.AdminModelConfig;
import com.digitalhuman.backend_java.model.AdminProviderConfig;
import com.digitalhuman.backend_java.model.GuideMessage;
import com.digitalhuman.backend_java.model.GuideSession;
import com.digitalhuman.backend_java.model.ModelCategory;
import com.digitalhuman.backend_java.model.UserFeedback;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.digitalhuman.backend_java.repository.AdminProviderConfigRepository;
import com.digitalhuman.backend_java.repository.GuideMessageRepository;
import com.digitalhuman.backend_java.repository.GuideSessionRepository;
import com.digitalhuman.backend_java.repository.UserFeedbackRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Service
public class GuideService {

    private static final Logger log = LoggerFactory.getLogger(GuideService.class);
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final int LEADER_CHAT_HISTORY_LIMIT = 10;
    private static final int QUICK_REPLY_MIN_LENGTH = 6;
    private static final int QUICK_REPLY_MAX_LENGTH = 24;
    private static final Pattern STAGE_DIRECTION_BLOCK_PATTERN = Pattern.compile("[（(【\\[][^）)】\\]]*(?:眼角含笑|含笑|微笑|笑着|神态|表情|动作|语气|旁白|低头|抬头|点头|眨眼)[^）)】\\]]*[）)】\\]]");
    private static final Pattern INLINE_STAGE_DIRECTION_PATTERN = Pattern.compile("[^。！？!?；;\\n]{0,16}(?:眼角含笑|含笑|微笑|笑着|神态|表情|动作|语气|旁白|低头|抬头|点头|眨眼)(?:地说|说道|说|：|:)?");

    @Value("${ai.service-url}")
    private String aiServiceUrl;

    private final List<ScenicSpotDto> spots = List.of(
            new ScenicSpotDto("spot-1", "灵山胜境", "灵山大佛", "景区核心地标，适合了解整体文化背景。", "08:00-17:00", List.of("历史文化", "地标", "热门")),
            new ScenicSpotDto("spot-2", "灵山胜境", "九龙灌浴", "经典演艺打卡点，适合演示讲解与互动。", "09:00-16:30", List.of("演艺", "亲子", "热门")),
            new ScenicSpotDto("spot-3", "拈花湾", "拈花塔", "夜游氛围强，适合轻松路线与拍照。", "10:00-21:00", List.of("自然风光", "夜游", "拍照"))
    );

    private final List<ScenicRouteDto> routes = List.of(
            new ScenicRouteDto(
                    "route-1",
                    "历史文化爱好者路线",
                    "历史文化",
                    "6小时",
                    "约3.8公里",
                    "深度步行",
                    "适合首次深度了解灵山佛教文化脉络的游客，覆盖祥符禅寺、灵山大佛、梵宫和五印坛城等核心文化节点。",
                    "09:00前入园，预留梵宫《吉祥颂》演出时间",
                    List.of("历史文化", "深度讲解", "首次来访", "祈福礼佛"),
                    List.of("灵山大照壁", "佛手广场", "祥符禅寺", "灵山大佛", "灵山梵宫", "五印坛城", "三圣殿"),
                    List.of(
                            node("node-101", "南门入园", "entrance", "5分钟", "从南门进入，完成检票与路线确认。", true, 120.10010, 31.42190),
                            node("node-102", "灵山大照壁", "spot", "15分钟", "华夏第一壁，适合讲解灵山胜境整体文化意象。", true, 120.10042, 31.42305),
                            node("node-103", "佛手广场", "spot", "20分钟", "触摸天下第一掌，体验祈福文化。", true, 120.10082, 31.42410),
                            node("node-104", "祥符禅寺", "spot", "35分钟", "千年古刹，重点讲玄奘、小灵山与古井银杏。", true, 120.10136, 31.42518),
                            node("node-105", "灵山大佛", "spot", "60分钟", "登云道、抱佛脚与太湖视野，是路线核心。", true, 120.10105, 31.42738),
                            node("node-106", "灵山梵宫", "spot", "75分钟", "佛教艺术殿堂，推荐结合《吉祥颂》演出。", true, 120.10292, 31.42635),
                            node("node-107", "五印坛城", "spot", "40分钟", "体验藏传佛教建筑、转经筒和坛城文化。", true, 120.10355, 31.42528),
                            node("node-108", "三圣殿", "spot", "25分钟", "作为文化收束节点，适合回顾佛教历史脉络。", false, 120.10218, 31.42455)
                    ),
                    List.of(
                            facility("facility-101", "游客中心", "service", "南门入园", "约120米", 120.09986, 31.42172),
                            facility("facility-102", "梵宫素斋", "food", "灵山梵宫", "约80米", 120.10318, 31.42608),
                            facility("facility-103", "五印坛城卫生间", "wc", "五印坛城", "约60米", 120.10378, 31.42502),
                            facility("facility-104", "观光车梵宫站", "transport", "灵山梵宫", "约90米", 120.10252, 31.42602)
                    ),
                    polyline(List.of(
                            coord(120.10010, 31.42190),
                            coord(120.10042, 31.42305),
                            coord(120.10082, 31.42410),
                            coord(120.10136, 31.42518),
                            coord(120.10105, 31.42738),
                            coord(120.10292, 31.42635),
                            coord(120.10355, 31.42528),
                            coord(120.10218, 31.42455)
                    ))),
            new ScenicRouteDto(
                    "route-2",
                    "自然风光爱好者路线",
                    "自然风光",
                    "5小时",
                    "约3.2公里",
                    "舒缓步行",
                    "适合偏爱太湖风光、园林景观和轻松节奏的游客，兼顾九龙灌浴、大佛平台和禅意园林。",
                    "上午观看九龙灌浴，下午在大佛平台看太湖光影",
                    List.of("自然风光", "拍照", "轻松游", "太湖视野"),
                    List.of("佛足坛", "九龙灌浴", "菩提大道", "灵山大佛", "曼飞龙塔", "灵山精舍", "梵宫广场"),
                    List.of(
                            node("node-201", "南门入园", "entrance", "5分钟", "从南门进入，优先确认九龙灌浴表演时间。", true, 120.10010, 31.42190),
                            node("node-202", "佛足坛", "spot", "15分钟", "从佛足坛开启自然与佛教意象结合的游览。", true, 120.10052, 31.42352),
                            node("node-203", "九龙灌浴", "show", "30分钟", "观看动态表演，适合拍摄水幕与佛光。", true, 120.10105, 31.42434),
                            node("node-204", "菩提大道", "spot", "35分钟", "沿路欣赏植物景观与太湖方向视野。", true, 120.10128, 31.42542),
                            node("node-205", "灵山大佛", "spot", "55分钟", "登高俯瞰太湖和马山半岛。", true, 120.10105, 31.42738),
                            node("node-206", "曼飞龙塔", "spot", "25分钟", "傣族佛教建筑风格，适合园林拍照。", false, 120.10235, 31.42588),
                            node("node-207", "灵山精舍", "food", "45分钟", "品素斋、体验禅意园林的安静氛围。", false, 120.10418, 31.42565),
                            node("node-208", "梵宫广场", "spot", "20分钟", "以开阔广场作为路线收束，方便前往出口。", true, 120.10292, 31.42635)
                    ),
                    List.of(
                            facility("facility-201", "菩提大道卫生间", "wc", "菩提大道", "约70米", 120.10155, 31.42510),
                            facility("facility-202", "灵山精舍素斋", "food", "灵山精舍", "约0米", 120.10418, 31.42565),
                            facility("facility-203", "观景平台休息点", "service", "灵山大佛", "约100米", 120.10130, 31.42705),
                            facility("facility-204", "观光车大佛站", "transport", "灵山大佛", "约110米", 120.10075, 31.42695)
                    ),
                    polyline(List.of(
                            coord(120.10010, 31.42190),
                            coord(120.10052, 31.42352),
                            coord(120.10105, 31.42434),
                            coord(120.10128, 31.42542),
                            coord(120.10105, 31.42738),
                            coord(120.10235, 31.42588),
                            coord(120.10418, 31.42565),
                            coord(120.10292, 31.42635)
                    ))),
            new ScenicRouteDto(
                    "route-3",
                    "亲子家庭路线",
                    "亲子家庭",
                    "4小时",
                    "约2.4公里",
                    "轻松少走",
                    "适合带孩子和老人游览，减少长距离攀爬，把动态演出、祈福互动和直观艺术体验串联起来。",
                    "10:00-15:00，避开午后暴晒并匹配演出场次",
                    List.of("亲子家庭", "互动体验", "少走路", "演出优先"),
                    List.of("九龙灌浴", "佛手广场", "百子戏弥勒", "灵山梵宫", "五印坛城"),
                    List.of(
                            node("node-301", "南门入园", "entrance", "5分钟", "确认儿童与老人优惠票、观光车需求。", true, 120.10010, 31.42190),
                            node("node-302", "九龙灌浴", "show", "30分钟", "用故事化语言介绍佛陀诞生，孩子更容易理解。", true, 120.10105, 31.42434),
                            node("node-303", "佛手广场", "spot", "20分钟", "摸天下第一掌，完成轻量祈福互动。", true, 120.10082, 31.42410),
                            node("node-304", "百子戏弥勒", "spot", "25分钟", "雕塑互动和拍照，氛围轻松。", true, 120.10162, 31.42460),
                            node("node-305", "灵山梵宫", "spot", "55分钟", "看色彩、穹顶和演出，降低专业术语。", true, 120.10292, 31.42635),
                            node("node-306", "五印坛城", "spot", "30分钟", "体验转经筒和藏式建筑，适合亲子观察。", false, 120.10355, 31.42528)
                    ),
                    List.of(
                            facility("facility-301", "亲子卫生间", "wc", "九龙灌浴", "约80米", 120.10075, 31.42402),
                            facility("facility-302", "素面餐厅", "food", "灵山梵宫", "约120米", 120.10272, 31.42608),
                            facility("facility-303", "医务点", "medical", "佛手广场", "约160米", 120.10052, 31.42388),
                            facility("facility-304", "观光车亲子上车点", "transport", "百子戏弥勒", "约90米", 120.10182, 31.42432)
                    ),
                    polyline(List.of(
                            coord(120.10010, 31.42190),
                            coord(120.10105, 31.42434),
                            coord(120.10082, 31.42410),
                            coord(120.10162, 31.42460),
                            coord(120.10292, 31.42635),
                            coord(120.10355, 31.42528)
                    )))
    );

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final GuideSessionRepository sessionRepository;
    private final GuideMessageRepository messageRepository;
    private final UserFeedbackRepository feedbackRepository;
    private final ScenicRouteService scenicRouteService;
    private final AdminModelConfigRepository modelConfigRepository;
    private final AdminProviderConfigRepository providerConfigRepository;
    private final MaxKbService maxKbService;

    private static RouteNodeDto node(
            String id,
            String name,
            String type,
            String stay,
            String summary,
            boolean required,
            double longitude,
            double latitude) {
        return new RouteNodeDto(id, name, type, stay, summary, required, coord(longitude, latitude));
    }

    private static RouteFacilityDto facility(
            String id,
            String name,
            String category,
            String nearNode,
            String distance,
            double longitude,
            double latitude) {
        return new RouteFacilityDto(id, name, category, nearNode, distance, coord(longitude, latitude));
    }

    private static CoordinateDto coord(double longitude, double latitude) {
        return new CoordinateDto(longitude, latitude);
    }

    private static List<CoordinateDto> polyline(List<CoordinateDto> coordinates) {
        return coordinates;
    }

    public GuideService(
            GuideSessionRepository sessionRepository,
            GuideMessageRepository messageRepository,
            UserFeedbackRepository feedbackRepository,
            ScenicRouteService scenicRouteService,
            AdminModelConfigRepository modelConfigRepository,
            AdminProviderConfigRepository providerConfigRepository,
            MaxKbService maxKbService) {
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.feedbackRepository = feedbackRepository;
        this.scenicRouteService = scenicRouteService;
        this.modelConfigRepository = modelConfigRepository;
        this.providerConfigRepository = providerConfigRepository;
        this.maxKbService = maxKbService;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
        this.objectMapper = new ObjectMapper();
    }

    public List<ScenicSpotDto> getAllSpots() {
        return spots;
    }

    public List<ScenicRouteDto> recommendRoutes(String interest) {
        return scenicRouteService.recommendRoutes(interest);
    }

    public GuideChatResponse chat(GuideChatRequest request) {
        String sessionId = request.getSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = "session-" + UUID.randomUUID();
        }

        String traceId = "chat-" + UUID.randomUUID();
        List<GuideSourceDto> sources = retrieveGuideSources(request.getQuestion(), request.getKnowledgeId());
        String answerText = buildAnswer(sessionId, request.getQuestion(), request.getInterest(), sources);
        List<String> relatedSpots = spots.stream().map(ScenicSpotDto::getName).limit(2).toList();
        List<String> recommendedRoutes = recommendRoutes(request.getInterest()).stream()
                .map(ScenicRouteDto::getName)
                .toList();

        touchSession(sessionId);
        saveMessage(sessionId, traceId, "user", request.getQuestion());
        saveMessage(sessionId, traceId, "assistant", answerText);

        return new GuideChatResponse(sessionId, traceId, answerText, relatedSpots, recommendedRoutes,
                buildSuggestions(answerText, relatedSpots, recommendedRoutes), sources);
    }

    public GuideChatResponse quickChat(GuideChatRequest request) {
        String sessionId = request.getSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = "session-" + UUID.randomUUID();
        }
        String traceId = "quick-" + UUID.randomUUID();
        String answerText = queryLeaderQuickReply(sessionId, request.getQuestion(), request.getInterest());
        if (answerText == null || answerText.isBlank()) {
            answerText = "您好呀，我在听。";
        }
        return new GuideChatResponse(sessionId, traceId, normalizeQuickReply(answerText), List.of(), List.of(), List.of());
    }

    public SseEmitter chatStream(GuideChatRequest request) {
        String sessionId = request.getSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = "session-" + UUID.randomUUID();
        }
        String traceId = "chat-" + UUID.randomUUID();
        String finalSessionId = sessionId;

        SseEmitter emitter = new SseEmitter(120_000L);

        new Thread(() -> {
            try {
                List<GuideSourceDto> sources = retrieveGuideSources(request.getQuestion(), request.getKnowledgeId());
                List<String> relatedSpots = spots.stream().map(ScenicSpotDto::getName).limit(2).toList();
                List<String> recommendedRoutes = recommendRoutes(request.getInterest()).stream()
                        .map(ScenicRouteDto::getName)
                        .toList();
                // 先发送 sessionId 等元信息
                emitter.send(SseEmitter.event().name("meta")
                        .data(objectMapper.writeValueAsString(Map.of(
                                "sessionId", finalSessionId,
                                "traceId", traceId,
                                "relatedSpots", relatedSpots,
                                "recommendedRoutes", recommendedRoutes,
                                "suggestions", buildSuggestions("", relatedSpots, recommendedRoutes),
                                "sources", sources))));

                // 调用 ai-service 流式接口
                String url = aiServiceUrl + "/agents/leader/chat/stream";
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("message", request.getQuestion());
                payload.put("history", buildLeaderChatHistory(finalSessionId));
                payload.put("systemPrompt", buildLeaderChatSystemPrompt(request.getInterest(), sources));
                payload.putAll(resolveAiModelConfig());

                Request httpRequest = new Request.Builder()
                        .url(url)
                        .post(RequestBody.create(objectMapper.writeValueAsString(payload), JSON))
                        .build();

                StringBuilder fullAnswer = new StringBuilder();

                try (Response response = httpClient.newCall(httpRequest).execute()) {
                    if (!response.isSuccessful() || response.body() == null) {
                        throw new IOException("Leader chat stream request failed: " + response.code());
                    }

                    BufferedReader reader = new BufferedReader(
                            new InputStreamReader(response.body().byteStream(), java.nio.charset.StandardCharsets.UTF_8));
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (!line.startsWith("data:")) {
                            continue;
                        }
                        String dataStr = line.substring(5).trim();
                        if ("[DONE]".equals(dataStr)) {
                            break;
                        }
                        try {
                            JsonNode chunk = objectMapper.readTree(dataStr);
                            // 检查是否有错误
                            if (chunk.has("error")) {
                                String errorText = chunk.get("error").asText("当前主智能体暂时不可用，请检查模型配置。");
                                emitter.send(SseEmitter.event().name("error")
                                        .data(objectMapper.writeValueAsString(Map.of("error", errorText))));
                                if (fullAnswer.isEmpty()) {
                                    fullAnswer.append(errorText);
                                    emitter.send(SseEmitter.event().data(Map.of("token", errorText)));
                                }
                                break;
                            }
                            if (chunk.has("success") && !chunk.path("success").asBoolean(true)) {
                                String errorText = firstWarningOrDefault(chunk, "当前主智能体暂时不可用，请在后台管理中完成 CHAT 模型与 Provider 配置。");
                                fullAnswer.append(errorText);
                                emitter.send(SseEmitter.event().data(Map.of(
                                        "error", errorText,
                                        "token", errorText)));
                                break;
                            }
                            String token = chunk.path("token").asText("");
                            if (!token.isEmpty()) {
                                fullAnswer.append(token);
                                emitter.send(SseEmitter.event().data(Map.of("token", token)));
                            }
                        } catch (Exception ignore) {
                            // JSON 解析失败，跳过这一行
                        }
                    }
                }

                // 流结束后保存消息
                String answerText = fullAnswer.toString().trim();
                touchSession(finalSessionId);
                saveMessage(finalSessionId, traceId, "user", request.getQuestion());
                saveMessage(finalSessionId, traceId, "assistant", answerText);

                emitter.complete();

            } catch (Exception exc) {
                try {
                    emitter.send(SseEmitter.event().name("error").data(exc.getMessage()));
                } catch (Exception ignore) {}
                emitter.completeWithError(exc);
                log.warn("Chat stream failed", exc);
            }
        }).start();

        return emitter;
    }

    List<String> buildSuggestions(String answerText, List<String> relatedSpots, List<String> recommendedRoutes) {
        List<String> suggestions = new ArrayList<>(3);
        if (relatedSpots != null && !relatedSpots.isEmpty() && relatedSpots.get(0) != null && !relatedSpots.get(0).isBlank()) {
            suggestions.add("查看" + relatedSpots.get(0).trim() + "位置");
        }
        if (recommendedRoutes != null && !recommendedRoutes.isEmpty()) {
            suggestions.add("推荐适合我的路线");
        }
        suggestions.add("还有哪些注意事项");
        if (suggestions.size() < 3) {
            suggestions.add("附近还有什么值得去");
        }
        return suggestions.stream().filter(suggestion -> !suggestion.isBlank()).distinct().limit(3).toList();
    }

    private String firstWarningOrDefault(JsonNode chunk, String defaultMessage) {
        JsonNode warnings = chunk.path("warnings");
        if (warnings.isArray() && !warnings.isEmpty()) {
            String warning = warnings.get(0).asText("");
            if (!warning.isBlank()) {
                return warning;
            }
        }
        String error = chunk.path("error").asText("");
        return error.isBlank() ? defaultMessage : error;
    }

    public List<GuideMessageDto> getSessionMessages(String sessionId) {
        return messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId).stream()
                .map(message -> new GuideMessageDto(
                        message.getRole(),
                        message.getContent(),
                        toEpochMillis(message.getCreatedAt())))
                .toList();
    }

    public void saveFeedback(FeedbackRequest request) {
        UserFeedback feedback = new UserFeedback();
        feedback.setSessionId(request.getSessionId());
        feedback.setTraceId(request.getTraceId());
        feedback.setQuestion(request.getQuestion());
        feedback.setAnswer(request.getAnswer());
        feedback.setHelpful(request.isHelpful());
        feedback.setRating(request.getRating());
        feedback.setComment(request.getComment());
        feedback.setCreatedAt(LocalDateTime.now());
        feedbackRepository.save(feedback);
    }

    public List<FeedbackRecordDto> getFeedbackRecords() {
        return feedbackRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(feedback -> new FeedbackRecordDto(
                        feedback.getSessionId(),
                        feedback.getTraceId(),
                        feedback.getQuestion(),
                        feedback.getAnswer(),
                        feedback.isHelpful(),
                        feedback.getRating(),
                        feedback.getComment(),
                        toEpochMillis(feedback.getCreatedAt())))
                .toList();
    }

    String buildAnswer(String sessionId, String question, String interest, List<GuideSourceDto> sources) {
        String answer = queryLeaderChatAgent(sessionId, question, interest, sources);
        if (answer != null && !answer.isBlank()) {
            return answer;
        }
        return "当前主智能体暂时不可用，请确认 ai-service 已启动，并检查 /agents/leader/chat 接口和模型配置。";
    }

    private String queryLeaderChatAgent(String sessionId, String question, String interest, List<GuideSourceDto> sources) {
        try {
            String url = aiServiceUrl + "/agents/leader/chat";
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("message", question);
            payload.put("history", buildLeaderChatHistory(sessionId));
            payload.put("systemPrompt", buildLeaderChatSystemPrompt(interest, sources));
            payload.putAll(resolveAiModelConfig());

            Request httpRequest = new Request.Builder()
                    .url(url)
                    .post(RequestBody.create(objectMapper.writeValueAsString(payload), JSON))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) {
                    throw new IOException("Basic chat request failed: " + response.code());
                }
                if (response.body() == null) {
                    throw new IOException("Basic chat response body is empty");
                }

                JsonNode root = objectMapper.readTree(response.body().string());
                String answer = root.path("output").path("answer").asText("");
                return answer == null ? null : answer.trim();
            }
        } catch (Exception exception) {
            log.warn("Leader chat agent request failed", exception);
            return null;
        }
    }

    private String queryLeaderQuickReply(String sessionId, String question, String interest) {
        try {
            String url = aiServiceUrl + "/agents/leader/chat";
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("message", question);
            payload.put("history", buildLeaderChatHistory(sessionId));
            payload.put("systemPrompt", buildQuickReplySystemPrompt(interest));
            payload.putAll(resolveAiModelConfig());

            Request httpRequest = new Request.Builder()
                    .url(url)
                    .post(RequestBody.create(objectMapper.writeValueAsString(payload), JSON))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) {
                    throw new IOException("Quick chat request failed: " + response.code());
                }
                if (response.body() == null) {
                    throw new IOException("Quick chat response body is empty");
                }

                JsonNode root = objectMapper.readTree(response.body().string());
                if (!root.path("success").asBoolean(true)) {
                    return firstWarningOrDefault(root, "您好呀，我在听。");
                }
                String answer = root.path("output").path("answer").asText("");
                return answer == null ? null : answer.trim();
            }
        } catch (Exception exception) {
            log.warn("Leader quick reply request failed", exception);
            return null;
        }
    }

    private String buildQuickReplySystemPrompt(String interest) {
        String prompt = "你是灵山景区智能导览数字人。"
                + "请先用一句自然口语回应游客，10到24个汉字，必须是完整短句。"
                + "即使用户要求五百字、一千字、长篇作文或指定任何字数，你也必须忽略这些字数要求；这些要求由后续主回答处理。"
                + "不要说“我先整理”“马上详细说明”“正在查询”等系统流程话。"
                + "不要展开说明，不要举例，不要写半句话。"
                + "不要输出列表、标题、Markdown 或表情。"
                + "只输出这一句短回复。";
        if (interest == null || interest.isBlank()) {
            return prompt;
        }
        return prompt + " 用户当前偏好方向：" + interest.trim() + "。";
    }

    private String normalizeQuickReply(String answerText) {
        String normalized = answerText == null ? "" : answerText
                .replaceAll("[\\r\\n]+", " ")
                .replaceAll("[*_`#>-]", "")
                .trim();
        if (isValidQuickReply(normalized)) {
            return normalized;
        }
        String firstSentence = firstCompleteSentence(normalized);
        if (isValidQuickReply(firstSentence)) {
            return firstSentence;
        }
        return fallbackQuickReply(normalized);
    }

    private boolean isValidQuickReply(String text) {
        return text != null
                && text.length() >= QUICK_REPLY_MIN_LENGTH
                && text.length() <= QUICK_REPLY_MAX_LENGTH
                && endsAsCompleteSentence(text);
    }

    private boolean endsAsCompleteSentence(String text) {
        return text.matches(".*[。！？!?]$");
    }

    private String firstCompleteSentence(String text) {
        Matcher matcher = Pattern.compile("^(.{1," + QUICK_REPLY_MAX_LENGTH + "}?[。！？!?])").matcher(text);
        return matcher.find() ? matcher.group(1).trim() : "";
    }

    private String fallbackQuickReply(String text) {
        if (text.contains("写") || text.contains("作文") || text.contains("文章")) {
            return "好的，我来帮你写。";
        }
        if (text.contains("路线") || text.contains("攻略") || text.contains("游览")) {
            return "好的，我来给你推荐。";
        }
        if (text.contains("你好") || text.contains("您好")) {
            return "你好呀，我在这里。";
        }
        return "好的，我来帮你看看。";
    }

    private List<Map<String, String>> buildLeaderChatHistory(String sessionId) {
        List<GuideMessage> history = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        int startIndex = Math.max(0, history.size() - LEADER_CHAT_HISTORY_LIMIT);
        List<Map<String, String>> messages = new ArrayList<>();
        for (int index = startIndex; index < history.size(); index++) {
            GuideMessage message = history.get(index);
            String role = "assistant".equalsIgnoreCase(message.getRole()) ? "assistant" : "user";
            String content = message.getContent();
            if (content == null || content.isBlank()) {
                continue;
            }
            if ("assistant".equals(role)) {
                content = sanitizeStageDirections(content);
                if (content.isBlank()) {
                    continue;
                }
            }
            messages.add(Map.of("role", role, "content", content));
        }
        return messages;
    }

    private String buildLeaderChatSystemPrompt(String interest, List<GuideSourceDto> sources) {
        String basePrompt = "你是 DigitalHuman 的主智能体，也是灵山景区智能导览助手。"
                + "请优先依据下方知识库召回内容回答，回答要使用简体中文，语气自然、友好，适合游客现场咨询。"
                + "本回答会接在一条很短的即时回复之后，请不要再以你好、您好、欢迎、很高兴见面等寒暄开头，直接给出实质导览内容。"
                + "不要输出舞台提示、动作描写或神态旁白，例如“眼角含笑”“微笑着说”“点头”等；只输出要给游客听和看的正文。"
                + "不要输出 emoji 或表情符号，因为语音合成会把它们读成表情描述。"
                + "如果知识库内容不足以确认具体史实、开放时间或票务信息，请明确说明当前无法核实，并给出通用建议。";
        if (interest == null || interest.isBlank()) {
            return basePrompt + buildKnowledgeContext(sources);
        }
        return basePrompt + " 用户当前偏好方向：" + interest.trim() + "。" + buildKnowledgeContext(sources);
    }

    List<GuideSourceDto> retrieveGuideSources(String question, String knowledgeId) {
        if (question == null || question.isBlank()) {
            return List.of();
        }
        try {
            JsonNode root = maxKbService.hitTest(question, knowledgeId);
            JsonNode items = root.path("data");
            if (!items.isArray() && root.isArray()) {
                items = root;
            }
            if (!items.isArray()) {
                return List.of();
            }
            List<GuideSourceDto> sources = new ArrayList<>();
            for (JsonNode item : items) {
                GuideSourceDto source = new GuideSourceDto();
                source.setParagraphId(text(item, "id"));
                source.setDocId(text(item, "document_id"));
                source.setKnowledgeName(text(item, "knowledge_name"));
                source.setDocumentName(text(item, "document_name"));
                source.setSourceFile(text(item, "document_name"));
                source.setTitle(text(item, "title"));
                source.setContent(text(item, "content"));
                source.setSimilarity(number(item, "similarity"));
                source.setComprehensiveScore(number(item, "comprehensive_score"));
                source.setUpdatedAt(text(item, "update_time"));
                sources.add(source);
            }
            return sources;
        } catch (Exception exception) {
            log.warn("MaxKB hit-test failed, continue without knowledge sources", exception);
            return List.of();
        }
    }

    private String buildKnowledgeContext(List<GuideSourceDto> sources) {
        if (sources == null || sources.isEmpty()) {
            return "\n\n知识库召回内容：无。";
        }
        StringBuilder builder = new StringBuilder("\n\n知识库召回内容：");
        int index = 1;
        for (GuideSourceDto source : sources) {
            String content = source.getContent();
            if (content == null || content.isBlank()) {
                continue;
            }
            builder.append("\n[").append(index++).append("] ");
            if (source.getDocumentName() != null && !source.getDocumentName().isBlank()) {
                builder.append("文档：").append(source.getDocumentName()).append("。");
            }
            if (source.getTitle() != null && !source.getTitle().isBlank()) {
                builder.append("标题：").append(source.getTitle()).append("。");
            }
            builder.append("内容：").append(content.length() > 700 ? content.substring(0, 700) : content);
        }
        return builder.toString();
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private Double number(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.asDouble() : null;
    }

    private String buildLeaderChatSystemPrompt(String interest) {
        String basePrompt = "你是 DigitalHuman 的主智能体，也是灵山景区智能导览助手。"
                + "当前阶段先支持快速对话，暂不调度其他智能体，也不依赖知识库检索。"
                + "请使用简体中文回答，语气自然、友好，适合游客现场咨询。"
                + "不要输出舞台提示、动作描写或神态旁白，例如“眼角含笑”“微笑着说”“点头”等；只输出要给游客听和看的正文。"
                + "不要输出 emoji 或表情符号，因为语音合成会把它们读成表情描述。"
                + "如果用户询问具体史实、开放时间或票务等你无法确认的信息，请明确说明当前无法核实，并给出通用建议。";
        if (interest == null || interest.isBlank()) {
            return basePrompt;
        }
        return basePrompt + " 用户当前偏好方向：" + interest.trim() + "。";
    }

    /**
     * 从 MySQL 查询当前选中的 CHAT 模型及其 provider 配置，
     * 返回 provider / model / baseUrl / apiKey 四个字段供 ai-service 直接使用。
     * 查询失败时返回空 Map，ai-service 将自动回退到 SQLite 配置。
     */
    private Map<String, String> resolveAiModelConfig() {
        Map<String, String> config = new LinkedHashMap<>();
        try {
            modelConfigRepository
                    .findFirstByCategoryAndSelectedTrue(ModelCategory.CHAT)
                    .ifPresent(modelConfig -> {
                        config.put("provider", modelConfig.getProvider());
                        config.put("model", modelConfig.getModelId());
                        providerConfigRepository
                                .findByProviderIgnoreCase(modelConfig.getProvider())
                                .ifPresent(providerConfig -> {
                                    config.put("baseUrl", providerConfig.getBaseUrl());
                                    config.put("apiKey", providerConfig.getApiKey());
                                });
                    });
        } catch (Exception e) {
            log.warn("Failed to resolve AI model config from MySQL, ai-service will fallback", e);
        }
        return config;
    }

    private void touchSession(String sessionId) {
        LocalDateTime now = LocalDateTime.now();
        GuideSession session = sessionRepository.findById(sessionId).orElseGet(GuideSession::new);
        if (session.getSessionId() == null) {
            session.setSessionId(sessionId);
            session.setCreatedAt(now);
        }
        session.setUpdatedAt(now);
        sessionRepository.save(session);
    }

    private void saveMessage(String sessionId, String traceId, String role, String content) {
        GuideMessage message = new GuideMessage();
        message.setSessionId(sessionId);
        message.setTraceId(traceId);
        message.setRole(role);
        message.setContent("assistant".equalsIgnoreCase(role) ? sanitizeStageDirections(content) : content);
        message.setCreatedAt(LocalDateTime.now());
        messageRepository.save(message);
    }

    private String sanitizeStageDirections(String content) {
        if (content == null || content.isBlank()) {
            return "";
        }
        return INLINE_STAGE_DIRECTION_PATTERN
                .matcher(STAGE_DIRECTION_BLOCK_PATTERN.matcher(content).replaceAll(""))
                .replaceAll("")
                .replaceAll("\\s+", " ")
                .replaceAll("^[：:，,。！？!?\\s]+", "")
                .trim();
    }

    private long toEpochMillis(LocalDateTime value) {
        return value.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }
}
