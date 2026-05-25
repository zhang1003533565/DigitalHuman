package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.FeedbackRecordDto;
import com.digitalhuman.backend_java.dto.FeedbackRequest;
import com.digitalhuman.backend_java.dto.GuideChatRequest;
import com.digitalhuman.backend_java.dto.GuideChatResponse;
import com.digitalhuman.backend_java.dto.GuideMessageDto;
import com.digitalhuman.backend_java.dto.RagQueryRequest;
import com.digitalhuman.backend_java.dto.RagQueryResponse;
import com.digitalhuman.backend_java.dto.RagSourceDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto.CoordinateDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto.RouteFacilityDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto.RouteNodeDto;
import com.digitalhuman.backend_java.dto.ScenicSpotDto;
import com.digitalhuman.backend_java.model.GuideMessage;
import com.digitalhuman.backend_java.model.GuideSession;
import com.digitalhuman.backend_java.model.UserFeedback;
import com.digitalhuman.backend_java.repository.GuideMessageRepository;
import com.digitalhuman.backend_java.repository.GuideSessionRepository;
import com.digitalhuman.backend_java.repository.UserFeedbackRepository;
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

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Service
public class GuideService {

    private static final Logger log = LoggerFactory.getLogger(GuideService.class);
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    @Value("${rag.service-url}")
    private String ragServiceUrl;

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
    private final RagTraceService ragTraceService;
    private final GuideSessionRepository sessionRepository;
    private final GuideMessageRepository messageRepository;
    private final UserFeedbackRepository feedbackRepository;
    private final ScenicRouteService scenicRouteService;

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
            RagTraceService ragTraceService,
            GuideSessionRepository sessionRepository,
            GuideMessageRepository messageRepository,
            UserFeedbackRepository feedbackRepository,
            ScenicRouteService scenicRouteService) {
        this.ragTraceService = ragTraceService;
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.feedbackRepository = feedbackRepository;
        this.scenicRouteService = scenicRouteService;
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

        String traceId = "rag-" + UUID.randomUUID();
        String reviewedAnswer = ragTraceService.findReusableReviewedAnswer(request.getQuestion());
        if (reviewedAnswer != null && !reviewedAnswer.isBlank()) {
            touchSession(sessionId);
            saveMessage(sessionId, traceId, "user", request.getQuestion());
            saveMessage(sessionId, traceId, "assistant", reviewedAnswer);
            return new GuideChatResponse(
                    sessionId,
                    traceId,
                    reviewedAnswer,
                    spots.stream().map(ScenicSpotDto::getName).limit(2).toList(),
                    recommendRoutes(request.getInterest()).stream().map(ScenicRouteDto::getName).toList(),
                    List.of());
        }
        RagQueryResponse ragResponse = queryRag(request, sessionId, traceId);
        String answerText = ragResponse != null && ragResponse.getAnswer() != null && !ragResponse.getAnswer().isBlank()
                ? ragResponse.getAnswer()
                : buildAnswer(request.getQuestion(), request.getInterest());
        List<String> relatedSpots = ragResponse != null && ragResponse.getRelatedSpots() != null && !ragResponse.getRelatedSpots().isEmpty()
                ? ragResponse.getRelatedSpots()
                : spots.stream().map(ScenicSpotDto::getName).limit(2).toList();
        List<String> recommendedRoutes = recommendRoutes(request.getInterest()).stream()
                .map(ScenicRouteDto::getName)
                .toList();
        List<RagSourceDto> sources = ragResponse != null && ragResponse.getSources() != null ? ragResponse.getSources() : List.of();

        touchSession(sessionId);
        saveMessage(sessionId, traceId, "user", request.getQuestion());
        saveMessage(sessionId, traceId, "assistant", answerText);

        return new GuideChatResponse(sessionId, traceId, answerText, relatedSpots, recommendedRoutes, sources);
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
        ragTraceService.attachFeedback(request.getTraceId(), request.isHelpful(), request.getRating(), request.getComment());
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

    private RagQueryResponse queryRag(GuideChatRequest request, String sessionId, String traceId) {
        try {
            String url = ragServiceUrl + "/rag/query";
            String json = objectMapper.writeValueAsString(new RagQueryRequest(request.getQuestion(), request.getInterest(), 5, sessionId, traceId));
            Request httpRequest = new Request.Builder()
                    .url(url)
                    .post(RequestBody.create(json, JSON))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) {
                    throw new IOException("RAG request failed: " + response.code());
                }
                if (response.body() == null) {
                    throw new IOException("RAG response body is empty");
                }
                RagQueryResponse ragResponse = objectMapper.readValue(response.body().string(), RagQueryResponse.class);
                ragTraceService.saveSuccess(traceId, sessionId, request, ragResponse);
                return ragResponse;
            }
        } catch (Exception exception) {
            log.warn("Falling back to local guide answer because RAG service is unavailable", exception);
            ragTraceService.saveFailure(traceId, sessionId, request, exception);
            return null;
        }
    }

    private String buildAnswer(String question, String interest) {
        return question;
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
        message.setContent(content);
        message.setCreatedAt(LocalDateTime.now());
        messageRepository.save(message);
    }

    private long toEpochMillis(LocalDateTime value) {
        return value.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }
}
