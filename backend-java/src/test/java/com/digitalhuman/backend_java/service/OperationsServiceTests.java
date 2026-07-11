package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.OperationsOverviewDto;
import com.digitalhuman.backend_java.repository.GuideMessageRepository;
import com.digitalhuman.backend_java.repository.GuideSessionRepository;
import com.digitalhuman.backend_java.repository.UserFeedbackRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OperationsServiceTests {

    private GuideSessionRepository sessionRepository;
    private GuideMessageRepository messageRepository;
    private UserFeedbackRepository feedbackRepository;
    private AdminSettingsService adminSettingsService;
    private OperationsService service;

    @BeforeEach
    void setUp() {
        sessionRepository = mock(GuideSessionRepository.class);
        messageRepository = mock(GuideMessageRepository.class);
        feedbackRepository = mock(UserFeedbackRepository.class);
        adminSettingsService = mock(AdminSettingsService.class);
        service = new OperationsService(sessionRepository, messageRepository, feedbackRepository, adminSettingsService);
    }

    @Test
    void overviewUsesPersistedSessionsMessagesAndFeedback() throws Exception {
        when(sessionRepository.countPersistedSessions()).thenReturn(3L);
        when(messageRepository.countPersistedMessages()).thenReturn(12L);
        when(feedbackRepository.countPersistedFeedback()).thenReturn(4L);
        when(feedbackRepository.countHelpfulFeedback()).thenReturn(3L);
        when(feedbackRepository.countFeedbackWithAnswer()).thenReturn(2L);
        when(feedbackRepository.averagePersistedRating()).thenReturn(4.5);
        when(feedbackRepository.findPopularQuestions()).thenReturn(List.<Object[]>of(new Object[]{"无锡亲子游怎么玩？", 3L}));
        when(feedbackRepository.findPopularRoutes()).thenReturn(List.<Object[]>of(new Object[]{"亲子路线", 2L}));
        when(adminSettingsService.getAiServiceHealth()).thenReturn(new ObjectMapper().readTree("{\"status\":\"ok\"}"));

        OperationsOverviewDto overview = service.getOverview();

        assertEquals(3, overview.visitorCount());
        assertEquals(3, overview.sessionCount());
        assertEquals(12, overview.messageCount());
        assertEquals(75.0, overview.successRate());
        assertEquals(50.0, overview.knowledgeHitRate());
        assertEquals(4.5, overview.averageRating());
        assertEquals("无锡亲子游怎么玩？", overview.popularQuestions().get(0).label());
        assertEquals("亲子路线", overview.popularRoutes().get(0).label());
        assertEquals("ok", overview.serviceHealth().get(0).status());
    }

    @Test
    void overviewReturnsZeroForEmptyDenominators() {
        when(feedbackRepository.findPopularQuestions()).thenReturn(List.of());
        when(feedbackRepository.findPopularRoutes()).thenReturn(List.of());

        OperationsOverviewDto overview = service.getOverview();

        assertEquals(0.0, overview.successRate());
        assertEquals(0.0, overview.knowledgeHitRate());
        assertEquals(0.0, overview.averageRating());
    }

    @Test
    void overviewDegradesOnlyFailedHealthCheck() {
        when(feedbackRepository.findPopularQuestions()).thenReturn(List.of());
        when(feedbackRepository.findPopularRoutes()).thenReturn(List.of());
        when(adminSettingsService.getAiServiceHealth()).thenThrow(new IllegalStateException("unavailable"));

        OperationsOverviewDto overview = service.getOverview();

        assertEquals(0, overview.messageCount());
        assertEquals(1, overview.serviceHealth().size());
        assertEquals("ai-service", overview.serviceHealth().get(0).name());
        assertEquals("degraded", overview.serviceHealth().get(0).status());
    }
}
