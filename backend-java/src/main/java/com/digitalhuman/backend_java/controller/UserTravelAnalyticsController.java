package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.service.TravelAnalyticsMetricService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user/travel-analytics")
public class UserTravelAnalyticsController {

    private final TravelAnalyticsMetricService metricService;

    public UserTravelAnalyticsController(TravelAnalyticsMetricService metricService) {
        this.metricService = metricService;
    }

    @GetMapping("/metrics/{metric}")
    public TravelAnalyticsMetricResponse getMetric(@PathVariable TravelAnalyticsMetric metric) {
        return metricService.queryMetric(TravelAnalyticsAudience.PUBLIC, metric);
    }
}
