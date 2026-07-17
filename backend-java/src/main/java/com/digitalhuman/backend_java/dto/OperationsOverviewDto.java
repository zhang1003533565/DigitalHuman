package com.digitalhuman.backend_java.dto;

import java.util.List;
import java.util.Map;

public record OperationsOverviewDto(
        long visitorCount,
        long sessionCount,
        long messageCount,
        double successRate,
        double knowledgeHitRate,
        double averageRating,
        Map<String, MetricTrend> metricTrends,
        List<RankedItem> popularQuestions,
        List<RankedItem> popularRoutes,
        List<ServiceHealthItem> serviceHealth,
        List<AlertItem> alerts,
        List<MapMarker> mapMarkers,
        List<MapRoute> mapRoutes
) {
    public record RankedItem(String label, long count) {
    }

    public record ServiceHealthItem(String name, String status, String message) {
    }

    public record MetricTrend(Double percentChange, String baselineLabel) {
    }

    public record AlertItem(String level, String title, String message, String time) {
    }

    public record Coordinate(double longitude, double latitude) {
    }

    public record MapMarker(String id, String name, String type, double longitude, double latitude, String summary) {
    }

    public record MapRoute(String id, String name, List<Coordinate> path) {
    }
}
