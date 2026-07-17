package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.OperationsOverviewDto;
import com.digitalhuman.backend_java.model.GuideMessage;
import com.digitalhuman.backend_java.model.GuideSession;
import com.digitalhuman.backend_java.model.ScenicRoute;
import com.digitalhuman.backend_java.model.ScenicRouteNode;
import com.digitalhuman.backend_java.model.UserFeedback;
import com.digitalhuman.backend_java.repository.GuideMessageRepository;
import com.digitalhuman.backend_java.repository.GuideSessionRepository;
import com.digitalhuman.backend_java.repository.ScenicFacilityRepository;
import com.digitalhuman.backend_java.repository.ScenicRouteRepository;
import com.digitalhuman.backend_java.repository.UserFeedbackRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
    @Autowired
    private ScenicRouteRepository scenicRouteRepository;
    @Autowired
    private ScenicFacilityRepository scenicFacilityRepository;

    private AdminSettingsService adminSettingsService;
    private OperationsService service;

    @BeforeEach
    void setUp() {
        adminSettingsService = mock(AdminSettingsService.class);
        service = new OperationsService(
                sessionRepository,
                messageRepository,
                feedbackRepository,
                scenicRouteRepository,
                scenicFacilityRepository,
                adminSettingsService);
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
        assertEquals("healthy", overview.serviceHealth().get(0).status());
        assertEquals("healthy", overview.serviceHealth().get(1).status());
        assertEquals("ok", overview.serviceHealth().get(2).status());
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
        assertEquals("degraded", overview.serviceHealth().get(2).status());
        assertEquals("unavailable", overview.serviceHealth().get(2).message());
    }

    @Test
    void overviewNormalizesDownHealthToDegradedAndKeepsDetail() throws Exception {
        when(adminSettingsService.getAiServiceHealth()).thenReturn(new ObjectMapper().readTree(
                "{\"status\":\"down\",\"message\":\"AI unavailable\",\"detail\":\"connection refused\"}"));

        OperationsOverviewDto overview = service.getOverview();

        assertEquals("degraded", overview.serviceHealth().get(2).status());
        assertEquals("AI unavailable; connection refused", overview.serviceHealth().get(2).message());
    }

    @Test
    void overviewBuildsMapDataFromPersistedRouteNodes() throws Exception {
        saveRouteWithNodes();
        when(adminSettingsService.getAiServiceHealth()).thenReturn(new ObjectMapper().readTree("{\"status\":\"ok\"}"));

        OperationsOverviewDto overview = service.getOverview();

        assertEquals(1, overview.mapRoutes().size());
        assertEquals("文化精华线", overview.mapRoutes().get(0).name());
        assertEquals(2, overview.mapRoutes().get(0).path().size());
        assertEquals("灵山大佛", overview.mapMarkers().get(0).name());
        assertEquals(120.10105, overview.mapMarkers().get(0).longitude());
        assertEquals(31.42738, overview.mapMarkers().get(0).latitude());
    }

    @Test
    void overviewReturnsRealAlertsFromHealthAndPendingFeedback() throws Exception {
        saveFeedback("需要人工处理", "route-1", false, 2);
        UserFeedback pending = feedbackRepository.findAll().get(0);
        pending.setStatus("PENDING");
        feedbackRepository.save(pending);
        when(adminSettingsService.getAiServiceHealth()).thenReturn(new ObjectMapper().readTree(
                "{\"status\":\"down\",\"message\":\"AI unavailable\"}"));

        OperationsOverviewDto overview = service.getOverview();

        assertEquals("warning", overview.alerts().get(0).level());
        assertEquals("AI 服务降级", overview.alerts().get(0).title());
        assertTrue(overview.alerts().stream().anyMatch(alert -> alert.title().equals("待处理游客反馈")));
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

    private void saveRouteWithNodes() {
        ScenicRoute route = new ScenicRoute();
        route.setId("route-1");
        route.setName("文化精华线");
        route.setSuitableFor("文化");
        route.setDuration("2小时");
        route.setEnabled(true);
        route.setSortOrder(1);

        ScenicRouteNode first = node("node-1", "灵山大佛", 1, 120.10105, 31.42738);
        first.setRoute(route);
        ScenicRouteNode second = node("node-2", "灵山梵宫", 2, 120.10292, 31.42635);
        second.setRoute(route);
        route.getNodes().add(first);
        route.getNodes().add(second);
        scenicRouteRepository.save(route);
    }

    private ScenicRouteNode node(String id, String name, int sortOrder, double longitude, double latitude) {
        ScenicRouteNode node = new ScenicRouteNode();
        node.setId(id);
        node.setName(name);
        node.setType("spot");
        node.setSortOrder(sortOrder);
        node.setRequiredNode(true);
        node.setLongitude(longitude);
        node.setLatitude(latitude);
        node.setSummary(name + "介绍");
        return node;
    }
}
