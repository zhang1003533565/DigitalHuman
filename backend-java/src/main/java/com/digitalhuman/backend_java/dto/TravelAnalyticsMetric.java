package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonValue;

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

    @Override
    public String toString() {
        return apiValue;
    }
}
