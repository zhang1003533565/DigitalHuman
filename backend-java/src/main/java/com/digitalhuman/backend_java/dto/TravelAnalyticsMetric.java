package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum TravelAnalyticsMetric {
    POPULAR_ATTRACTIONS("popular_attractions"),
    AVERAGE_STAY_DURATION("average_stay_duration"),
    AVERAGE_SPEND("average_spend"),
    AVERAGE_SATISFACTION("average_satisfaction"),
    COMMON_VISITOR_SEGMENTS("common_visitor_segments");

    private final String apiValue;

    TravelAnalyticsMetric(String apiValue) {
        this.apiValue = apiValue;
    }

    @JsonValue
    public String apiValue() {
        return apiValue;
    }

    @JsonCreator
    public static TravelAnalyticsMetric fromValue(String value) {
        return Arrays.stream(values())
                .filter(metric -> metric.apiValue.equals(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown travel analytics metric: " + value));
    }

    @Override
    public String toString() {
        return apiValue;
    }
}
