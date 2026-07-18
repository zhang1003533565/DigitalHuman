package com.digitalhuman.backend_java.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record TravelAnalyticsMetricResponse(
        TravelAnalyticsMetric metric,
        TravelAnalyticsAudience scope,
        long totalSamples,
        long validSamples,
        LocalDate asOf,
        List<Item> items,
        String warning
) {
    public TravelAnalyticsMetricResponse {
        items = items == null ? List.of() : List.copyOf(items);
    }

    public record Item(String label, BigDecimal value) {
    }
}
