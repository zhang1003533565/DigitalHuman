package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.OperationsOverviewDto;
import com.digitalhuman.backend_java.dto.OperationsOverviewDto.RankedItem;
import com.digitalhuman.backend_java.dto.OperationsOverviewDto.ServiceHealthItem;
import com.digitalhuman.backend_java.repository.GuideMessageRepository;
import com.digitalhuman.backend_java.repository.GuideSessionRepository;
import com.digitalhuman.backend_java.repository.UserFeedbackRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Locale;
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
    private final AdminSettingsService adminSettingsService;

    public OperationsService(GuideSessionRepository sessionRepository,
                             GuideMessageRepository messageRepository,
                             UserFeedbackRepository feedbackRepository,
                             AdminSettingsService adminSettingsService) {
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.feedbackRepository = feedbackRepository;
        this.adminSettingsService = adminSettingsService;
    }

    @Transactional(readOnly = true)
    public OperationsOverviewDto getOverview() {
        long sessionCount = sessionRepository.countPersistedSessions();
        long feedbackCount = feedbackRepository.countPersistedFeedback();
        long assistantMessageCount = messageRepository.countAssistantMessages();
        Double averageRating = feedbackRepository.averagePersistedRating();
        return new OperationsOverviewDto(
                sessionCount,
                sessionCount,
                messageRepository.countPersistedMessages(),
                percentage(feedbackRepository.countHelpfulFeedback(), feedbackCount),
                percentage(messageRepository.countKnowledgeHitAssistantMessages(), assistantMessageCount),
                averageRating == null ? 0.0 : averageRating,
                rankedItems(feedbackRepository.findPopularQuestions(PageRequest.of(0, RANKING_LIMIT))),
                rankedItems(feedbackRepository.findPopularRoutes(PageRequest.of(0, RANKING_LIMIT))),
                List.of(aiServiceHealth())
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
