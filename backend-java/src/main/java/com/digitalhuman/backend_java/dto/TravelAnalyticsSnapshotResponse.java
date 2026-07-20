package com.digitalhuman.backend_java.dto;

import java.time.LocalDateTime;
import java.util.List;

public record TravelAnalyticsSnapshotResponse(
        TravelAnalyticsSnapshotStatus status,
        Long batchId,
        LocalDateTime createdAt,
        LocalDateTime completedAt,
        String createdBy,
        Long sourceRecordCount,
        Long currentRecordCount,
        List<TravelAnalyticsMetricResponse> metrics,
        String failureMessage
) {
    public TravelAnalyticsSnapshotResponse {
        metrics = metrics == null ? List.of() : List.copyOf(metrics);
    }
}
