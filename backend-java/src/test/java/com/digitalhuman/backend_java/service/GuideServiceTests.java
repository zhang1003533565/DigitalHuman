package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.GuideChatResponse;
import com.digitalhuman.backend_java.dto.GuideChatRequest;
import com.digitalhuman.backend_java.dto.FeedbackRequest;
import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.model.UserFeedback;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.digitalhuman.backend_java.repository.AdminProviderConfigRepository;
import com.digitalhuman.backend_java.repository.GuideMessageRepository;
import com.digitalhuman.backend_java.model.GuideMessage;
import com.digitalhuman.backend_java.repository.GuideSessionRepository;
import com.digitalhuman.backend_java.repository.UserFeedbackRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import okio.Buffer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.argThat;
import okhttp3.Call;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.anyList;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import org.mockito.ArgumentCaptor;

class GuideServiceTests {
    private static final String PERSONAL_DATA_REFUSAL = "抱歉，我只能提供脱敏后的群体统计信息，不能提供任何游客个人数据或行程明细。";
    private static final String TRAVEL_ANALYTICS_UNAVAILABLE = "抱歉，当前脱敏旅游统计暂未开放，暂时无法回答这类群体统计问题。";

    private GuideService service;
    private GuideSessionRepository sessionRepository;
    private ScenicRouteService scenicRouteService;
    private AdminModelConfigRepository modelConfigRepository;
    private UserFeedbackRepository feedbackRepository;
    private GuideMessageRepository messageRepository;
    private MaxKbService maxKbService;
    private TravelAnalyticsMetricService travelAnalyticsMetricService;

    @BeforeEach
    void setUp() {
        sessionRepository = mock(GuideSessionRepository.class);
        scenicRouteService = mock(ScenicRouteService.class);
        modelConfigRepository = mock(AdminModelConfigRepository.class);
        feedbackRepository = mock(UserFeedbackRepository.class);
        messageRepository = mock(GuideMessageRepository.class);
        maxKbService = mock(MaxKbService.class);
        travelAnalyticsMetricService = mock(TravelAnalyticsMetricService.class);
        doAnswer(invocation -> {
            GuideMessage message = invocation.getArgument(0);
            if ("assistant".equals(message.getRole())) message.setId(42L);
            return message;
        }).when(messageRepository).save(any(GuideMessage.class));
        service = spy(new GuideService(
                sessionRepository,
                messageRepository,
                feedbackRepository,
                scenicRouteService,
                modelConfigRepository,
                mock(AdminProviderConfigRepository.class),
                maxKbService,
                Runnable::run,
                travelAnalyticsMetricService,
                new TravelAnalyticsIntentClassifier()));
    }

    @Test
    void chatResponseIncludesPersistedAssistantMessageId() {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of());
        doReturn(List.of()).when(service).retrieveGuideSources("问题", null);
        doReturn("回答").when(service).buildAnswer("session-1", "问题", null, List.of());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("问题");

        GuideChatResponse response = service.chat(request);

        assertEquals(42L, response.getMessageId());
    }

    @Test
    void sessionFeedbackIsScopedAndNormalizesLegacyNulls() {
        UserFeedback feedback = new UserFeedback();
        feedback.setSessionId("session-1");
        feedback.setQuestion("问题");
        feedback.setCreatedAt(LocalDateTime.now());
        when(feedbackRepository.findBySessionIdOrderByCreatedAtDesc("session-1")).thenReturn(List.of(feedback));

        var records = service.getFeedbackRecordsForSession(" session-1 ");

        assertEquals(1, records.size());
        assertEquals("PENDING", records.get(0).getStatus());
        assertEquals("GENERAL", records.get(0).getCategory());
        verify(feedbackRepository).findBySessionIdOrderByCreatedAtDesc("session-1");
    }

    @Test
    void sessionFeedbackRejectsBlankSessionId() {
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.getFeedbackRecordsForSession(" "));
    }

    @Test
    void chatPersistsKnowledgeHitOnAssistantMessage() {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of());
        com.digitalhuman.backend_java.dto.GuideSourceDto source = new com.digitalhuman.backend_java.dto.GuideSourceDto();
        source.setKnowledgeName("知识库");
        source.setContent("命中内容");
        doReturn(List.of(source)).when(service).retrieveGuideSources("问题", null);
        doReturn("回答").when(service).buildAnswer(org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.anyList());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("问题");

        service.chat(request);

        ArgumentCaptor<GuideMessage> captor = ArgumentCaptor.forClass(GuideMessage.class);
        verify(messageRepository, org.mockito.Mockito.atLeast(2)).save(captor.capture());
        GuideMessage assistant = captor.getAllValues().stream()
                .filter(message -> "assistant".equals(message.getRole()))
                .findFirst()
                .orElseThrow();
        assertTrue(assistant.isKnowledgeHit());
    }

    @Test
    void saveFeedbackKeepsContext() {
        FeedbackRequest request = new FeedbackRequest();
        request.setSessionId("session-2");
        request.setTraceId("trace-2");
        request.setRouteId("route-3");
        request.setMessageId(42L);
        request.setQuestion("路线是否合理？");
        request.setRating(4);

        service.saveFeedback(request);

        ArgumentCaptor<UserFeedback> captor = ArgumentCaptor.forClass(UserFeedback.class);
        verify(feedbackRepository).save(captor.capture());
        UserFeedback saved = captor.getValue();
        assertEquals("route-3", saved.getRouteId());
        assertEquals(42L, saved.getMessageId());
        assertEquals("PENDING", saved.getStatus());
        assertEquals("CONTEXTUAL", saved.getCategory());
    }

    @Test
    void saveFeedbackWithoutContextIsGeneral() {
        FeedbackRequest request = new FeedbackRequest();
        request.setQuestion("普通意见");
        request.setRating(3);
        request.setCategory("CONTEXTUAL");

        service.saveFeedback(request);

        ArgumentCaptor<UserFeedback> captor = ArgumentCaptor.forClass(UserFeedback.class);
        verify(feedbackRepository).save(captor.capture());
        assertEquals("GENERAL", captor.getValue().getCategory());
    }

    @Test
    void feedbackRecordsExposeModerationAndContextFields() {
        UserFeedback feedback = new UserFeedback();
        feedback.setId(7L);
        feedback.setSessionId("session-2");
        feedback.setTraceId("trace-2");
        feedback.setRouteId("route-3");
        feedback.setMessageId(42L);
        feedback.setQuestion("问题");
        feedback.setAnswer("回答");
        feedback.setHelpful(true);
        feedback.setRating(5);
        feedback.setComment("意见");
        feedback.setStatus("RESOLVED");
        feedback.setCategory("CONTEXTUAL");
        feedback.setAdminNote("已处理");
        feedback.setCreatedAt(LocalDateTime.of(2026, 7, 11, 12, 0));
        when(feedbackRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(feedback));

        var record = service.getFeedbackRecords().get(0);

        assertEquals(7L, record.getId());
        assertEquals("route-3", record.getRouteId());
        assertEquals(42L, record.getMessageId());
        assertEquals("RESOLVED", record.getStatus());
        assertEquals("CONTEXTUAL", record.getCategory());
        assertEquals("已处理", record.getAdminNote());
        assertEquals(feedback.getCreatedAt(), record.getCreatedAt());
    }

    @Test
    void updateFeedbackPersistsValidatedModerationFields() {
        UserFeedback feedback = new UserFeedback();
        feedback.setId(7L);
        when(feedbackRepository.findById(7L)).thenReturn(Optional.of(feedback));

        var record = service.updateFeedback(7L, "RESOLVED", "ROUTE", "已联系路线负责人");

        assertEquals("RESOLVED", feedback.getStatus());
        assertEquals("ROUTE", feedback.getCategory());
        assertEquals("已联系路线负责人", feedback.getAdminNote());
        assertEquals(7L, record.getId());
        verify(feedbackRepository).save(feedback);
    }

    @Test
    void updateFeedbackRejectsUnsupportedStatusAndCategory() {
        UserFeedback feedback = new UserFeedback();
        when(feedbackRepository.findById(7L)).thenReturn(Optional.of(feedback));

        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.updateFeedback(7L, "UNKNOWN", "ROUTE", null));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.updateFeedback(7L, "PENDING", "UNKNOWN", null));
    }

    @Test
    void ordinaryChatDoesNotGenerateFallbackRecommendationsOrSuggestions() {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        var route = mock(com.digitalhuman.backend_java.dto.ScenicRouteDto.class);
        when(route.getId()).thenReturn("route-2");
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of(route));
        when(modelConfigRepository.findFirstByCategoryAndSelectedTrue(org.mockito.ArgumentMatchers.any()))
                .thenReturn(Optional.empty());
        doReturn(List.of()).when(service).retrieveGuideSources("灵山大佛有多高？", null);
        doReturn("灵山大佛高88米。").when(service)
                .buildAnswer("session-1", "灵山大佛有多高？", null, List.of());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("灵山大佛有多高？");

        GuideChatResponse response = service.chat(request);

        assertTrue(response.getRelatedSpots().isEmpty());
        assertTrue(response.getRecommendedRoutes().isEmpty());
        assertTrue(response.getSuggestions().isEmpty());
        verify(scenicRouteService, never()).recommendRoutes(any());
    }

    @Test
    void mentioningARouteDoesNotTurnAnOrdinaryQuestionIntoARecommendation() {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        when(modelConfigRepository.findFirstByCategoryAndSelectedTrue(org.mockito.ArgumentMatchers.any()))
                .thenReturn(Optional.empty());
        doReturn(List.of()).when(service).retrieveGuideSources("这条路线有多长？", null);
        doReturn("全程约五公里。").when(service)
                .buildAnswer("session-1", "这条路线有多长？", null, List.of());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("这条路线有多长？");

        GuideChatResponse response = service.chat(request);

        assertTrue(response.getRecommendedRoutes().isEmpty());
        verify(scenicRouteService, never()).recommendRoutes(any());
    }

    @Test
    void chatReturnsRealRouteIdsInsteadOfDisplayNames() {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        var route = mock(com.digitalhuman.backend_java.dto.ScenicRouteDto.class);
        when(route.getId()).thenReturn("route-2");
        when(route.getName()).thenReturn("自然风光爱好者路线");
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of(route));
        doReturn(List.of()).when(service).retrieveGuideSources("请推荐一条适合上午游览的路线", null);
        doReturn("建议走自然风光路线。").when(service)
                .buildAnswer("session-1", "请推荐一条适合上午游览的路线", null, List.of());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("请推荐一条适合上午游览的路线");

        assertEquals(List.of("route-2"), service.chat(request).getRecommendedRoutes());
    }

    @Test
    void outboundAiRequestCarriesCurrentTraceId() throws Exception {
        OkHttpClient client = mock(OkHttpClient.class);
        Call call = mock(Call.class);
        when(client.newCall(argThat(request -> "trace-outbound-1234".equals(request.header("X-Trace-Id")))))
                .thenReturn(call);
        Response response = new Response.Builder().request(new Request.Builder().url("http://ai.test").build())
                .protocol(Protocol.HTTP_1_1).code(200).message("ok")
                .body(ResponseBody.create("{\"success\":true,\"output\":{\"answer\":\"你好呀，我在这里。\"}}",
                        MediaType.get("application/json"))).build();
        when(call.execute()).thenReturn(response);
        ReflectionTestUtils.setField(service, "httpClient", client);
        ReflectionTestUtils.setField(service, "aiServiceUrl", "http://ai.test");
        when(messageRepository.findBySessionIdOrderByCreatedAtAsc("session-1")).thenReturn(List.of());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("你好");
        MDC.put("traceId", "trace-outbound-1234");
        try {
            assertEquals("trace-outbound-1234", service.quickChat(request).getTraceId());
        } finally {
            MDC.clear();
        }
        verify(client).newCall(any(Request.class));
    }

    @Test
    void chatRoutesMetricQuestionsToPublicTravelAnalytics() {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of());
        when(travelAnalyticsMetricService.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_STAY_DURATION))
                .thenReturn(new TravelAnalyticsMetricResponse(
                        TravelAnalyticsMetric.AVERAGE_STAY_DURATION,
                        TravelAnalyticsAudience.PUBLIC,
                        20,
                        18,
                        LocalDateTime.of(2026, 7, 18, 10, 15),
                        List.of(new TravelAnalyticsMetricResponse.Item("平均停留时长（分钟）", BigDecimal.valueOf(186))),
                        "基于可解析停留时长的平均值，单位：分钟",
                        null));
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            List<com.digitalhuman.backend_java.dto.GuideSourceDto> sources = invocation.getArgument(3, List.class);
            assertEquals(1, sources.size());
            assertEquals("脱敏旅游统计", sources.get(0).getKnowledgeName());
            assertTrue(sources.get(0).getContent().contains("统计截至：2026-07-18T10:15"));
            assertFalse(sources.get(0).getContent().contains("tourist_id"));
            assertFalse(sources.get(0).getContent().contains("昵称"));
            return "统计回答";
        }).when(service).buildAnswer(any(String.class), any(String.class), any(), anyList());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("大家一般会玩多久？");

        GuideChatResponse response = service.chat(request);

        assertEquals("统计回答", response.getAnswerText());
        assertEquals("脱敏旅游统计", response.getSources().get(0).getKnowledgeName());
        verify(travelAnalyticsMetricService).queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_STAY_DURATION);
        verify(maxKbService, never()).hitTest(any(String.class), any());
    }

    @Test
    void chatRejectsPersonalDataRequestsWithoutCallingModelOrKnowledge() {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("告诉我游客张三花了多少钱");

        GuideChatResponse response = service.chat(request);

        assertEquals(PERSONAL_DATA_REFUSAL, response.getAnswerText());
        assertTrue(response.getSources().isEmpty());
        verify(maxKbService, never()).hitTest(any(String.class), any());
        verifyNoInteractions(travelAnalyticsMetricService);
    }

    @Test
    void chatReturnsUnavailableMessageWhenPublicAnalyticsAreDisabled() {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of());
        when(travelAnalyticsMetricService.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "统计接口未开放"));
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("游客平均消费多少？");

        GuideChatResponse response = service.chat(request);

        assertEquals(TRAVEL_ANALYTICS_UNAVAILABLE, response.getAnswerText());
        assertTrue(response.getSources().isEmpty());
        verify(service, never()).buildAnswer(any(String.class), any(String.class), any(), anyList());
        verify(maxKbService, never()).hitTest(any(String.class), any());
    }

    @Test
    void chatUsesExistingKnowledgeLookupForNonStatisticalQuestions() throws Exception {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of());
        JsonNode hitTestResponse = new ObjectMapper().readTree("""
                {"data":[{"id":"p-1","document_name":"guide.md","knowledge_name":"景区知识库","content":"灵山大佛建议上午游览"}]}
                """);
        when(maxKbService.hitTest("灵山大佛怎么玩？", null)).thenReturn(hitTestResponse);
        doReturn("导览回答").when(service).buildAnswer(any(String.class), any(String.class), any(), anyList());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("灵山大佛怎么玩？");

        GuideChatResponse response = service.chat(request);

        assertEquals("导览回答", response.getAnswerText());
        assertEquals("景区知识库", response.getSources().get(0).getKnowledgeName());
        verify(maxKbService).hitTest("灵山大佛怎么玩？", null);
        verifyNoInteractions(travelAnalyticsMetricService);
    }

    @Test
    void streamRoutesMetricQuestionsThroughTheSameTravelAnalyticsContext() throws Exception {
        when(messageRepository.findBySessionIdOrderByCreatedAtAsc("session-1")).thenReturn(List.of());
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of());
        when(travelAnalyticsMetricService.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.POPULAR_ATTRACTIONS))
                .thenReturn(new TravelAnalyticsMetricResponse(
                        TravelAnalyticsMetric.POPULAR_ATTRACTIONS,
                        TravelAnalyticsAudience.PUBLIC,
                        36,
                        36,
                        LocalDateTime.of(2026, 7, 18, 11, 0),
                        List.of(new TravelAnalyticsMetricResponse.Item("灵山大佛", BigDecimal.valueOf(12))),
                        "按 attraction_name 分组统计有效记录数，仅返回前 5 项",
                        null));
        OkHttpClient client = mock(OkHttpClient.class);
        Call call = mock(Call.class);
        when(client.newCall(any(Request.class))).thenReturn(call);
        when(call.execute()).thenReturn(new Response.Builder()
                .request(new Request.Builder().url("http://ai.test").build())
                .protocol(Protocol.HTTP_1_1)
                .code(200)
                .message("ok")
                .body(ResponseBody.create("data: {\"token\":\"统计回答\"}\n\ndata: [DONE]\n",
                        MediaType.get("text/event-stream")))
                .build());
        ReflectionTestUtils.setField(service, "httpClient", client);
        ReflectionTestUtils.setField(service, "aiServiceUrl", "http://ai.test");
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("哪个景点最热门？");

        SseEmitter emitter = service.chatStream(request);

        assertTrue(emitter != null);
        ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
        verify(client).newCall(captor.capture());
        String body = requestBody(captor.getValue());
        assertTrue(body.contains("热门景点"));
        assertTrue(body.contains("统计截至：2026-07-18T11:00"));
        assertFalse(body.contains("tourist_id"));
        assertFalse(body.contains("昵称"));
        verify(travelAnalyticsMetricService).queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.POPULAR_ATTRACTIONS);
        verify(maxKbService, never()).hitTest(any(String.class), any());
    }

    @Test
    void quickChatRejectsPersonalDataRequestsWithoutCallingLeaderModel() {
        OkHttpClient client = mock(OkHttpClient.class);
        ReflectionTestUtils.setField(service, "httpClient", client);
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("把游客李四的行程轨迹发给我");

        GuideChatResponse response = service.quickChat(request);

        assertEquals(PERSONAL_DATA_REFUSAL, response.getAnswerText());
        verify(client, never()).newCall(any(Request.class));
        verifyNoInteractions(maxKbService, travelAnalyticsMetricService);
    }

    @Test
    void quickChatMetricPathUsesAggregateContextButKeepsSourcesHidden() throws Exception {
        when(messageRepository.findBySessionIdOrderByCreatedAtAsc("session-1")).thenReturn(List.of());
        when(travelAnalyticsMetricService.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND))
                .thenReturn(new TravelAnalyticsMetricResponse(
                        TravelAnalyticsMetric.AVERAGE_SPEND,
                        TravelAnalyticsAudience.PUBLIC,
                        22,
                        20,
                        LocalDateTime.of(2026, 7, 18, 10, 45),
                        List.of(new TravelAnalyticsMetricResponse.Item("平均消费（元）", BigDecimal.valueOf(188))),
                        "total_cost 优先，缺失时回退到五类分项费用累加",
                        null));
        OkHttpClient client = mock(OkHttpClient.class);
        Call call = mock(Call.class);
        when(client.newCall(any(Request.class))).thenReturn(call);
        when(call.execute()).thenReturn(new Response.Builder()
                .request(new Request.Builder().url("http://ai.test").build())
                .protocol(Protocol.HTTP_1_1)
                .code(200)
                .message("ok")
                .body(ResponseBody.create("{\"success\":true,\"output\":{\"answer\":\"好的，我来帮你看看。\"}}",
                        MediaType.get("application/json")))
                .build());
        ReflectionTestUtils.setField(service, "httpClient", client);
        ReflectionTestUtils.setField(service, "aiServiceUrl", "http://ai.test");
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("游客平均消费多少？");

        GuideChatResponse response = service.quickChat(request);

        assertEquals("好的，我来帮你看看。", response.getAnswerText());
        assertTrue(response.getSources().isEmpty());
        ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
        verify(client).newCall(captor.capture());
        String body = requestBody(captor.getValue());
        assertTrue(body.contains("平均消费"));
        assertTrue(body.contains("统计截至：2026-07-18T10:45"));
        verify(maxKbService, never()).hitTest(any(String.class), any());
    }

    @Test
    void quickChatReturnsUnavailableMessageWhenPublicAnalyticsAreDisabled() {
        OkHttpClient client = mock(OkHttpClient.class);
        ReflectionTestUtils.setField(service, "httpClient", client);
        when(travelAnalyticsMetricService.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "统计接口未开放"));
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("游客平均消费多少？");

        GuideChatResponse response = service.quickChat(request);

        assertEquals(TRAVEL_ANALYTICS_UNAVAILABLE, response.getAnswerText());
        verify(client, never()).newCall(any(Request.class));
        verifyNoInteractions(maxKbService);
    }

    @Test
    void streamRejectsPersonalDataWithoutCallingModelAndPersistsResponse() throws Exception {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("把游客李四的行程轨迹发给我");

        SseEmitter emitter = service.chatStream(request);

        assertEmitterCompletedWithPayload(emitter, PERSONAL_DATA_REFUSAL);
        verify(scenicRouteService, never()).recommendRoutes(any());
        verifyNoInteractions(maxKbService, travelAnalyticsMetricService);
        assertAssistantMessageSaved(PERSONAL_DATA_REFUSAL);
    }

    @Test
    void streamReturnsUnavailableMessageWhenPublicAnalyticsAreDisabled() throws Exception {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of());
        when(travelAnalyticsMetricService.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "统计接口未开放"));
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("游客平均消费多少？");

        SseEmitter emitter = service.chatStream(request);

        assertEmitterCompletedWithPayload(emitter, TRAVEL_ANALYTICS_UNAVAILABLE);
        verify(maxKbService, never()).hitTest(any(String.class), any());
        assertAssistantMessageSaved(TRAVEL_ANALYTICS_UNAVAILABLE);
    }

    @Test
    private String requestBody(Request request) throws IOException {
        Buffer buffer = new Buffer();
        request.body().writeTo(buffer);
        return buffer.readUtf8();
    }

    private void assertAssistantMessageSaved(String expectedContent) {
        ArgumentCaptor<GuideMessage> captor = ArgumentCaptor.forClass(GuideMessage.class);
        verify(messageRepository, org.mockito.Mockito.atLeast(2)).save(captor.capture());
        GuideMessage assistant = captor.getAllValues().stream()
                .filter(message -> "assistant".equals(message.getRole()))
                .reduce((first, second) -> second)
                .orElseThrow();
        assertEquals(42L, assistant.getId());
        assertEquals(expectedContent, assistant.getContent());
    }

    @SuppressWarnings("unchecked")
    private void assertEmitterCompletedWithPayload(SseEmitter emitter, String expectedText) throws Exception {
        assertNotNull(emitter);
        assertTrue((Boolean) ReflectionTestUtils.getField(emitter, "complete"));
        Set<Object> earlySendAttempts = (Set<Object>) ReflectionTestUtils.getField(emitter, "earlySendAttempts");
        assertNotNull(earlySendAttempts);
        List<String> payloads = new ArrayList<>();
        for (Object attempt : earlySendAttempts) {
            Object data = ReflectionTestUtils.invokeMethod(attempt, "getData");
            payloads.add(String.valueOf(data));
        }
        String joined = String.join("\n", payloads);
        assertTrue(joined.contains(expectedText));
        assertTrue(joined.contains("messageId"));
    }
}
