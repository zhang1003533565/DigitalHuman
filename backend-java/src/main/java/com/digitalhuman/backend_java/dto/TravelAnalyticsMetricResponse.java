package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record TravelAnalyticsMetricResponse(
        TravelAnalyticsMetric metric,
        TravelAnalyticsAudience scope,
        long totalSamples,
        long validSamples,
        @JsonFormat(shape = JsonFormat.Shape.STRING)
        LocalDateTime asOf,
        List<Item> items,
        String methodology,
        String warning
) {
    public TravelAnalyticsMetricResponse {
        items = items == null ? List.of() : List.copyOf(items);
    }

    public record Item(String label, BigDecimal value) {
    }
}
