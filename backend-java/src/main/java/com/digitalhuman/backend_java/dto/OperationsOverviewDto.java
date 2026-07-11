package com.digitalhuman.backend_java.dto;

import java.util.List;

public record OperationsOverviewDto(
        long visitorCount,
        long sessionCount,
        long messageCount,
        double successRate,
        double knowledgeHitRate,
        double averageRating,
        List<RankedItem> popularQuestions,
        List<RankedItem> popularRoutes,
        List<ServiceHealthItem> serviceHealth
) {
    public record RankedItem(String label, long count) {
    }

    public record ServiceHealthItem(String name, String status, String message) {
    }
}
