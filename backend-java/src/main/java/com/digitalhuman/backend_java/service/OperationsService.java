package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.OperationsOverviewDto;
import com.digitalhuman.backend_java.dto.OperationsOverviewDto.AlertItem;
import com.digitalhuman.backend_java.dto.OperationsOverviewDto.Coordinate;
import com.digitalhuman.backend_java.dto.OperationsOverviewDto.MapMarker;
import com.digitalhuman.backend_java.dto.OperationsOverviewDto.MapRoute;
import com.digitalhuman.backend_java.dto.OperationsOverviewDto.MetricTrend;
import com.digitalhuman.backend_java.dto.OperationsOverviewDto.RankedItem;
import com.digitalhuman.backend_java.dto.OperationsOverviewDto.ServiceHealthItem;
import com.digitalhuman.backend_java.model.ScenicFacility;
import com.digitalhuman.backend_java.model.ScenicRoute;
import com.digitalhuman.backend_java.model.ScenicRouteNode;
import com.digitalhuman.backend_java.repository.GuideMessageRepository;
import com.digitalhuman.backend_java.repository.GuideSessionRepository;
import com.digitalhuman.backend_java.repository.ScenicFacilityRepository;
import com.digitalhuman.backend_java.repository.ScenicRouteRepository;
import com.digitalhuman.backend_java.repository.UserFeedbackRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OperationsService {
    private static final int RANKING_LIMIT = 5;

    private final GuideSessionRepository sessionRepository;
    private final GuideMessageRepository messageRepository;
    private final UserFeedbackRepository feedbackRepository;
    private final ScenicRouteRepository scenicRouteRepository;
    private final ScenicFacilityRepository scenicFacilityRepository;
    private final AdminSettingsService adminSettingsService;

    public OperationsService(GuideSessionRepository sessionRepository,
                             GuideMessageRepository messageRepository,
                             UserFeedbackRepository feedbackRepository,
                             ScenicRouteRepository scenicRouteRepository,
                             ScenicFacilityRepository scenicFacilityRepository,
                             AdminSettingsService adminSettingsService) {
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.feedbackRepository = feedbackRepository;
        this.scenicRouteRepository = scenicRouteRepository;
        this.scenicFacilityRepository = scenicFacilityRepository;
        this.adminSettingsService = adminSettingsService;
    }

    @Transactional(readOnly = true)
    public OperationsOverviewDto getOverview() {
        long sessionCount = sessionRepository.countPersistedSessions();
        long feedbackCount = feedbackRepository.countPersistedFeedback();
        long assistantMessageCount = messageRepository.countAssistantMessages();
        long knowledgeHitCount = messageRepository.countKnowledgeHitAssistantMessages();
        Double averageRating = feedbackRepository.averagePersistedRating();
        ServiceHealthItem aiHealth = aiServiceHealth();
        List<MapRoute> mapRoutes = buildMapRoutes();
        List<MapMarker> mapMarkers = buildMapMarkers(mapRoutes);
        return new OperationsOverviewDto(
                sessionCount,
                sessionCount,
                messageRepository.countPersistedMessages(),
                percentage(feedbackRepository.countHelpfulFeedback(), feedbackCount),
                percentage(knowledgeHitCount, assistantMessageCount),
                averageRating == null ? 0.0 : averageRating,
                buildMetricTrends(),
                rankedItems(feedbackRepository.findPopularQuestions(PageRequest.of(0, RANKING_LIMIT))),
                rankedItems(feedbackRepository.findPopularRoutes(PageRequest.of(0, RANKING_LIMIT))),
                List.of(
                        new ServiceHealthItem("backend-java", "healthy", "运营总览接口正常响应"),
                        new ServiceHealthItem("database", "healthy", "已读取会话、消息、反馈与景区数据"),
                        aiHealth
                ),
                buildAlerts(aiHealth, assistantMessageCount, knowledgeHitCount, feedbackRepository.countByStatus("PENDING")),
                mapMarkers,
                mapRoutes
        );
    }

    private double percentage(long numerator, long denominator) {
        return denominator == 0 ? 0.0 : numerator * 100.0 / denominator;
    }

    private List<RankedItem> rankedItems(List<Object[]> rows) {
        return rows.stream()
                .limit(RANKING_LIMIT)
                .map(row -> new RankedItem(String.valueOf(row[0]), ((Number) row[1]).longValue()))
                .toList();
    }

    private Map<String, MetricTrend> buildMetricTrends() {
        LocalDateTime todayStart = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime tomorrowStart = todayStart.plusDays(1);
        LocalDateTime yesterdayStart = todayStart.minusDays(1);
        Map<String, MetricTrend> trends = new LinkedHashMap<>();

        trends.put("visitorCount", trend(
                sessionRepository.countByCreatedAtBetween(todayStart, tomorrowStart),
                sessionRepository.countByCreatedAtBetween(yesterdayStart, todayStart)));
        trends.put("sessionCount", trends.get("visitorCount"));
        trends.put("messageCount", trend(
                messageRepository.countByCreatedAtBetween(todayStart, tomorrowStart),
                messageRepository.countByCreatedAtBetween(yesterdayStart, todayStart)));
        trends.put("successRate", trend(
                percentage(
                        feedbackRepository.countHelpfulFeedbackByCreatedAtBetween(todayStart, tomorrowStart),
                        feedbackRepository.countByCreatedAtBetween(todayStart, tomorrowStart)),
                percentage(
                        feedbackRepository.countHelpfulFeedbackByCreatedAtBetween(yesterdayStart, todayStart),
                        feedbackRepository.countByCreatedAtBetween(yesterdayStart, todayStart))));
        trends.put("knowledgeHitRate", trend(
                percentage(
                        messageRepository.countKnowledgeHitAssistantMessagesByCreatedAtBetween(todayStart, tomorrowStart),
                        messageRepository.countAssistantMessagesByCreatedAtBetween(todayStart, tomorrowStart)),
                percentage(
                        messageRepository.countKnowledgeHitAssistantMessagesByCreatedAtBetween(yesterdayStart, todayStart),
                        messageRepository.countAssistantMessagesByCreatedAtBetween(yesterdayStart, todayStart))));
        trends.put("averageRating", trend(
                defaultDouble(feedbackRepository.averageRatingByCreatedAtBetween(todayStart, tomorrowStart)),
                defaultDouble(feedbackRepository.averageRatingByCreatedAtBetween(yesterdayStart, todayStart))));
        return trends;
    }

    private MetricTrend trend(double current, double previous) {
        if (previous == 0.0) {
            return new MetricTrend(null, "暂无昨日基线");
        }
        return new MetricTrend((current - previous) * 100.0 / previous, "较昨日");
    }

    private double defaultDouble(Double value) {
        return value == null ? 0.0 : value;
    }

    private List<AlertItem> buildAlerts(ServiceHealthItem aiHealth, long assistantMessageCount, long knowledgeHitCount, long pendingFeedbackCount) {
        List<AlertItem> alerts = new ArrayList<>();
        String time = LocalTime.now().withSecond(0).withNano(0).toString();
        if (!isHealthy(aiHealth.status())) {
            alerts.add(new AlertItem("warning", "AI 服务降级", defaultText(aiHealth.message(), "健康检查未通过"), time));
        }
        double hitRate = percentage(knowledgeHitCount, assistantMessageCount);
        if (assistantMessageCount > 0 && hitRate < 60.0) {
            alerts.add(new AlertItem("warning", "知识命中率偏低", String.format(Locale.ROOT, "当前知识命中率 %.1f%%，建议检查知识库覆盖。", hitRate), time));
        }
        if (pendingFeedbackCount > 0) {
            alerts.add(new AlertItem("info", "待处理游客反馈", pendingFeedbackCount + " 条反馈等待处理。", time));
        }
        if (alerts.isEmpty()) {
            alerts.add(new AlertItem("success", "运营状态正常", "当前未发现需要处理的运营告警。", time));
        }
        return alerts;
    }

    private List<MapRoute> buildMapRoutes() {
        return scenicRouteRepository.findByEnabledTrueOrderBySortOrderAsc().stream()
                .map(route -> new MapRoute(
                        route.getId(),
                        route.getName(),
                        route.getNodes().stream()
                                .filter(node -> node.getLongitude() != null && node.getLatitude() != null)
                                .map(node -> new Coordinate(node.getLongitude(), node.getLatitude()))
                                .toList()
                ))
                .filter(route -> route.path().size() >= 2)
                .limit(RANKING_LIMIT)
                .toList();
    }

    private List<MapMarker> buildMapMarkers(List<MapRoute> mapRoutes) {
        Map<String, MapMarker> markers = new LinkedHashMap<>();
        scenicRouteRepository.findByEnabledTrueOrderBySortOrderAsc().forEach(route ->
                route.getNodes().stream()
                        .filter(node -> node.getLongitude() != null && node.getLatitude() != null)
                        .forEach(node -> markers.putIfAbsent(
                                "route-node:" + node.getId(),
                                routeNodeMarker(route, node)
                        )));
        scenicFacilityRepository.findAllByDeletedAtIsNullOrderByUpdatedAtDescIdDesc().stream()
                .filter(facility -> facility.getLongitude() != null && facility.getLatitude() != null)
                .forEach(facility -> markers.put(
                        "facility:" + facility.getId(),
                        facilityMarker(facility)
                ));
        if (markers.isEmpty() && !mapRoutes.isEmpty()) {
            mapRoutes.get(0).path().forEach(point -> markers.put(
                    "route-point:" + markers.size(),
                    new MapMarker("route-point-" + markers.size(), mapRoutes.get(0).name(), "route", point.longitude(), point.latitude(), "路线坐标点")
            ));
        }
        return markers.values().stream().limit(80).toList();
    }

    private MapMarker routeNodeMarker(ScenicRoute route, ScenicRouteNode node) {
        return new MapMarker(
                node.getId(),
                node.getName(),
                defaultText(node.getType(), "spot"),
                node.getLongitude(),
                node.getLatitude(),
                defaultText(node.getSummary(), route.getName())
        );
    }

    private MapMarker facilityMarker(ScenicFacility facility) {
        String categoryName = facility.getCategory() == null ? "facility" : facility.getCategory().getName();
        return new MapMarker(
                "facility-" + facility.getId(),
                facility.getName(),
                "facility",
                facility.getLongitude().doubleValue(),
                facility.getLatitude().doubleValue(),
                categoryName
        );
    }

    private boolean isHealthy(String status) {
        return status != null && List.of("healthy", "up", "ok").contains(status.toLowerCase(Locale.ROOT));
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private ServiceHealthItem aiServiceHealth() {
        try {
            JsonNode health = adminSettingsService.getAiServiceHealth();
            String rawStatus = health == null ? "" : health.path("status").asText("");
            String normalizedStatus = rawStatus.toLowerCase(Locale.ROOT);
            String status = switch (normalizedStatus) {
                case "ok", "healthy", "up" -> normalizedStatus;
                default -> "degraded";
            };
            String message = health == null
                    ? "健康检查未返回数据"
                    : Stream.of(health.path("message").asText(""), health.path("detail").asText(""))
                            .filter(value -> !value.isBlank())
                            .reduce((left, right) -> left + "; " + right)
                            .orElse("");
            return new ServiceHealthItem("ai-service", status, message);
        } catch (Exception exception) {
            return new ServiceHealthItem("ai-service", "degraded", String.valueOf(exception.getMessage()));
        }
    }
}
