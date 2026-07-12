package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.GuideChatResponse;
import com.digitalhuman.backend_java.dto.GuideChatRequest;
import com.digitalhuman.backend_java.dto.FeedbackRequest;
import com.digitalhuman.backend_java.model.UserFeedback;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.digitalhuman.backend_java.repository.AdminProviderConfigRepository;
import com.digitalhuman.backend_java.repository.GuideMessageRepository;
import com.digitalhuman.backend_java.model.GuideMessage;
import com.digitalhuman.backend_java.repository.GuideSessionRepository;
import com.digitalhuman.backend_java.repository.UserFeedbackRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import org.springframework.test.util.ReflectionTestUtils;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.doAnswer;
import org.mockito.ArgumentCaptor;

class GuideServiceTests {

    private GuideService service;
    private GuideSessionRepository sessionRepository;
    private ScenicRouteService scenicRouteService;
    private AdminModelConfigRepository modelConfigRepository;
    private UserFeedbackRepository feedbackRepository;
    private GuideMessageRepository messageRepository;

    @BeforeEach
    void setUp() {
        sessionRepository = mock(GuideSessionRepository.class);
        scenicRouteService = mock(ScenicRouteService.class);
        modelConfigRepository = mock(AdminModelConfigRepository.class);
        feedbackRepository = mock(UserFeedbackRepository.class);
        messageRepository = mock(GuideMessageRepository.class);
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
                mock(MaxKbService.class)));
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
    void chatResponseIncludesThreeNonBlankSuggestions() {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of());
        when(modelConfigRepository.findFirstByCategoryAndSelectedTrue(org.mockito.ArgumentMatchers.any()))
                .thenReturn(Optional.empty());
        doReturn(List.of()).when(service).retrieveGuideSources("灵山大佛怎么玩？", null);
        doReturn("建议上午先去灵山大佛。").when(service)
                .buildAnswer("session-1", "灵山大佛怎么玩？", null, List.of());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("灵山大佛怎么玩？");

        GuideChatResponse response = service.chat(request);

        assertEquals(3, response.getSuggestions().size());
        assertTrue(response.getSuggestions().stream().allMatch(suggestion -> !suggestion.isBlank()));
    }

    @Test
    void chatReturnsRealRouteIdsInsteadOfDisplayNames() {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        var route = mock(com.digitalhuman.backend_java.dto.ScenicRouteDto.class);
        when(route.getId()).thenReturn("route-2");
        when(route.getName()).thenReturn("自然风光爱好者路线");
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of(route));
        doReturn(List.of()).when(service).retrieveGuideSources("问题", null);
        doReturn("回答").when(service).buildAnswer("session-1", "问题", null, List.of());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("问题");

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
    void buildsThreeNonBlankFollowUpSuggestionsForGuideAnswer() {
        List<String> relatedSpots = List.of("灵山大佛", "九龙灌浴");
        List<String> recommendedRoutes = List.of("历史文化爱好者路线");
        GuideChatResponse response = new GuideChatResponse(
                "session-1", "trace-1", "灵山大佛适合上午游览。", relatedSpots, recommendedRoutes,
                service.buildSuggestions("灵山大佛适合上午游览。", relatedSpots, recommendedRoutes), List.of());

        assertEquals(3, response.getSuggestions().size());
        assertTrue(response.getSuggestions().stream().allMatch(suggestion -> suggestion != null && !suggestion.isBlank()));
    }
}
