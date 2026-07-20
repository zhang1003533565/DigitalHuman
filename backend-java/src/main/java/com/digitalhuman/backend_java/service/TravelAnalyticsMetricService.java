package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class TravelAnalyticsMetricService {

    private static final Set<TravelAnalyticsMetric> PUBLIC_METRICS = EnumSet.of(
            TravelAnalyticsMetric.POPULAR_ATTRACTIONS,
            TravelAnalyticsMetric.AVERAGE_STAY_DURATION,
            TravelAnalyticsMetric.AVERAGE_SPEND,
            TravelAnalyticsMetric.AVERAGE_SATISFACTION,
            TravelAnalyticsMetric.COMMON_VISITOR_SEGMENTS
    );

    private final TravelAnalyticsSnapshotService snapshotService;
    private final TravelAnalyticsAiConfigService aiConfigService;

    public TravelAnalyticsMetricService(
            TravelAnalyticsSnapshotService snapshotService,
            TravelAnalyticsAiConfigService aiConfigService) {
        this.snapshotService = Objects.requireNonNull(snapshotService, "snapshotService");
        this.aiConfigService = Objects.requireNonNull(aiConfigService, "aiConfigService");
    }

    public TravelAnalyticsMetricResponse queryMetric(
            TravelAnalyticsAudience audience,
            TravelAnalyticsMetric metric) {
        if (audience == TravelAnalyticsAudience.PUBLIC && !PUBLIC_METRICS.contains(metric)) {
            throw new IllegalArgumentException("Unsupported public travel analytics metric: " + metric);
        }
        if (audience == TravelAnalyticsAudience.PUBLIC && !publicAccessEnabled()) {
            throw new ResponseStatusException(NOT_FOUND, "统计接口未开放");
        }
        return snapshotService.getMetric(audience, metric);
    }

    private boolean publicAccessEnabled() {
        return !Boolean.FALSE.equals(aiConfigService.getConfig().getPublicEnabled());
    }
}
