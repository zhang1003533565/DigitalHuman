package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.FeedbackRecordDto;
import com.digitalhuman.backend_java.dto.FeedbackRequest;
import com.digitalhuman.backend_java.dto.GuideChatRequest;
import com.digitalhuman.backend_java.dto.GuideChatResponse;
import com.digitalhuman.backend_java.dto.GuideMessageDto;
import com.digitalhuman.backend_java.dto.RagQueryRequest;
import com.digitalhuman.backend_java.dto.RagQueryResponse;
import com.digitalhuman.backend_java.dto.ScenicRouteDto;
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
            new ScenicRouteDto("route-1", "历史文化爱好者路线", "历史文化", "6小时", "适合首次深度了解灵山文化脉络的游客。", List.of("灵山大佛", "九龙灌浴")),
            new ScenicRouteDto("route-2", "自然风光爱好者路线", "自然风光", "5小时", "适合偏爱景观和放松游览节奏的游客。", List.of("拈花塔", "灵山大佛")),
            new ScenicRouteDto("route-3", "亲子家庭路线", "亲子家庭", "4小时", "适合家庭出游，节奏更轻松，互动点更集中。", List.of("九龙灌浴", "拈花塔"))
    );

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final RagTraceService ragTraceService;
    private final GuideSessionRepository sessionRepository;
    private final GuideMessageRepository messageRepository;
    private final UserFeedbackRepository feedbackRepository;

    public GuideService(
            RagTraceService ragTraceService,
            GuideSessionRepository sessionRepository,
            GuideMessageRepository messageRepository,
            UserFeedbackRepository feedbackRepository) {
        this.ragTraceService = ragTraceService;
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.feedbackRepository = feedbackRepository;
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
        if (interest == null || interest.isBlank()) {
            return routes;
        }

        return routes.stream()
                .filter(route -> route.getSuitableFor().contains(interest))
                .toList();
    }

    public GuideChatResponse chat(GuideChatRequest request) {
        String sessionId = request.getSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = "session-" + UUID.randomUUID();
        }

        String traceId = "rag-" + UUID.randomUUID();
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

        touchSession(sessionId);
        saveMessage(sessionId, traceId, "user", request.getQuestion());
        saveMessage(sessionId, traceId, "assistant", answerText);

        return new GuideChatResponse(sessionId, traceId, answerText, relatedSpots, recommendedRoutes);
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
