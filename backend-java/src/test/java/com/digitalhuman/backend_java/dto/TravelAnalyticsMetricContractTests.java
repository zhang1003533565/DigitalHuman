package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TravelAnalyticsMetricContractTests {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void serializesMethodologyAndTimestampFields() throws Exception {
        TravelAnalyticsMetricResponse response = new TravelAnalyticsMetricResponse(
                TravelAnalyticsMetric.AVERAGE_SPEND,
                TravelAnalyticsAudience.PUBLIC,
                12,
                10,
                LocalDateTime.of(2026, 7, 18, 15, 45, 30),
                List.of(new TravelAnalyticsMetricResponse.Item("人均消费", new BigDecimal("128.50"))),
                "total_cost 优先，缺失时回退到五类分项费用累加",
                null
        );

        String json = objectMapper.writeValueAsString(response);
        var root = objectMapper.readTree(json);

        assertEquals("total_cost 优先，缺失时回退到五类分项费用累加", root.get("methodology").asText());
        assertEquals("2026-07-18T15:45:30", root.get("asOf").asText());
    }

    @Test
    void bindsSnakeCaseMetricValuesInbound() throws Exception {
        TravelAnalyticsMetric metric = objectMapper.readValue("\"average_spend\"", TravelAnalyticsMetric.class);

        assertEquals(TravelAnalyticsMetric.AVERAGE_SPEND, metric);
    }
}
