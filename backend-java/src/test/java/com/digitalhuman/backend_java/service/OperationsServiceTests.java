package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.OperationsOverviewDto;
import com.digitalhuman.backend_java.model.GuideMessage;
import com.digitalhuman.backend_java.model.GuideSession;
import com.digitalhuman.backend_java.model.UserFeedback;
import com.digitalhuman.backend_java.repository.GuideMessageRepository;
import com.digitalhuman.backend_java.repository.GuideSessionRepository;
import com.digitalhuman.backend_java.repository.UserFeedbackRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DataJpaTest
class OperationsServiceTests {

    @Autowired
    private GuideSessionRepository sessionRepository;
    @Autowired
    private GuideMessageRepository messageRepository;
    @Autowired
    private UserFeedbackRepository feedbackRepository;

    private AdminSettingsService adminSettingsService;
    private OperationsService service;

    @BeforeEach
    void setUp() {
        adminSettingsService = mock(AdminSettingsService.class);
        service = new OperationsService(sessionRepository, messageRepository, feedbackRepository, adminSettingsService);
    }

    @Test
    void overviewUsesPersistedSessionsMessagesAndFeedback() throws Exception {
        saveSession("s1");
        saveSession("s2");
        saveSession("s3");
        saveMessage("s1", "user", false);
        saveMessage("s1", "assistant", true);
        saveMessage("s2", "assistant", false);
        saveFeedback("无锡亲子游怎么玩？", "亲子路线", true, 4);
        saveFeedback("无锡亲子游怎么玩？", "亲子路线", false, 5);
        when(adminSettingsService.getAiServiceHealth()).thenReturn(new ObjectMapper().readTree("{\"status\":\"ok\"}"));

        OperationsOverviewDto overview = service.getOverview();

        assertEquals(3, overview.visitorCount());
        assertEquals(3, overview.sessionCount());
        assertEquals(3, overview.messageCount());
        assertEquals(50.0, overview.successRate());
        assertEquals(50.0, overview.knowledgeHitRate());
        assertEquals(4.5, overview.averageRating());
        assertEquals("无锡亲子游怎么玩？", overview.popularQuestions().get(0).label());
        assertEquals("亲子路线", overview.popularRoutes().get(0).label());
        assertEquals("ok", overview.serviceHealth().get(0).status());
    }

    @Test
    void overviewReturnsZeroForEmptyDenominators() {
        OperationsOverviewDto overview = service.getOverview();

        assertEquals(0.0, overview.successRate());
        assertEquals(0.0, overview.knowledgeHitRate());
        assertEquals(0.0, overview.averageRating());
    }

    @Test
    void overviewDegradesThrownHealthCheckWithoutBlockingMetrics() {
        saveMessage("s1", "assistant", true);
        when(adminSettingsService.getAiServiceHealth()).thenThrow(new IllegalStateException("unavailable"));

        OperationsOverviewDto overview = service.getOverview();

        assertEquals(1, overview.messageCount());
        assertEquals("degraded", overview.serviceHealth().get(0).status());
        assertEquals("unavailable", overview.serviceHealth().get(0).message());
    }

    @Test
    void overviewNormalizesDownHealthToDegradedAndKeepsDetail() throws Exception {
        when(adminSettingsService.getAiServiceHealth()).thenReturn(new ObjectMapper().readTree(
                "{\"status\":\"down\",\"message\":\"AI unavailable\",\"detail\":\"connection refused\"}"));

        OperationsOverviewDto overview = service.getOverview();

        assertEquals("degraded", overview.serviceHealth().get(0).status());
        assertEquals("AI unavailable; connection refused", overview.serviceHealth().get(0).message());
    }

    private void saveSession(String sessionId) {
        GuideSession session = new GuideSession();
        session.setSessionId(sessionId);
        session.setCreatedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        sessionRepository.save(session);
    }

    private void saveMessage(String sessionId, String role, boolean knowledgeHit) {
        GuideMessage message = new GuideMessage();
        message.setSessionId(sessionId);
        message.setRole(role);
        message.setContent("content");
        message.setKnowledgeHit(knowledgeHit);
        message.setCreatedAt(LocalDateTime.now());
        messageRepository.save(message);
    }

    private void saveFeedback(String question, String routeId, boolean helpful, int rating) {
        UserFeedback feedback = new UserFeedback();
        feedback.setQuestion(question);
        feedback.setRouteId(routeId);
        feedback.setHelpful(helpful);
        feedback.setRating(rating);
        feedback.setCategory("CONTEXTUAL");
        feedback.setCreatedAt(LocalDateTime.now());
        feedbackRepository.save(feedback);
    }
}
