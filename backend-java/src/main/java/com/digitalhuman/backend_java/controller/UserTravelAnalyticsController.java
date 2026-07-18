package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.service.TravelAnalyticsAiConfigService;
import com.digitalhuman.backend_java.service.TravelAnalyticsMetricService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api/user/travel-analytics")
public class UserTravelAnalyticsController {

    private final TravelAnalyticsMetricService metricService;
    private final TravelAnalyticsAiConfigService aiConfigService;

    public UserTravelAnalyticsController(
            TravelAnalyticsMetricService metricService,
            TravelAnalyticsAiConfigService aiConfigService) {
        this.metricService = metricService;
        this.aiConfigService = aiConfigService;
    }

    @GetMapping("/metrics/{metric}")
    public TravelAnalyticsMetricResponse getMetric(@PathVariable TravelAnalyticsMetric metric) {
        if (!aiConfigService.getConfig().getPublicEnabled()) {
            throw new ResponseStatusException(NOT_FOUND, "统计接口未开放");
        }
        return metricService.queryMetric(TravelAnalyticsAudience.PUBLIC, metric);
    }
}
