package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.GuideChatResponse;
import com.digitalhuman.backend_java.dto.GuideChatRequest;
import com.digitalhuman.backend_java.dto.FeedbackRequest;
import com.digitalhuman.backend_java.model.UserFeedback;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.digitalhuman.backend_java.repository.AdminProviderConfigRepository;
import com.digitalhuman.backend_java.repository.GuideMessageRepository;
import com.digitalhuman.backend_java.repository.GuideSessionRepository;
import com.digitalhuman.backend_java.repository.UserFeedbackRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import org.mockito.ArgumentCaptor;

class GuideServiceTests {

    private GuideService service;
    private GuideSessionRepository sessionRepository;
    private ScenicRouteService scenicRouteService;
    private AdminModelConfigRepository modelConfigRepository;
    private UserFeedbackRepository feedbackRepository;

    @BeforeEach
    void setUp() {
        sessionRepository = mock(GuideSessionRepository.class);
        scenicRouteService = mock(ScenicRouteService.class);
        modelConfigRepository = mock(AdminModelConfigRepository.class);
        feedbackRepository = mock(UserFeedbackRepository.class);
        service = spy(new GuideService(
                sessionRepository,
                mock(GuideMessageRepository.class),
                feedbackRepository,
                scenicRouteService,
                modelConfigRepository,
                mock(AdminProviderConfigRepository.class),
                mock(MaxKbService.class)));
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
