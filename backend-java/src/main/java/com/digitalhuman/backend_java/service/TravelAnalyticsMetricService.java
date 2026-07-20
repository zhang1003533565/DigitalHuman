package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.model.TravelAnalyticsAiConfig;
import com.digitalhuman.backend_java.model.TravelAnalyticsRecord;
import com.digitalhuman.backend_java.repository.TravelAnalyticsRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.util.EnumSet;
import java.util.List;
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
    private static final int DEFAULT_PUBLIC_MINIMUM_SAMPLE_SIZE = 10;

    private final TravelAnalyticsRecordRepository recordRepository;
    private final TravelAnalyticsMetricCalculator metricCalculator;
    private final TravelAnalyticsAiConfigService aiConfigService;
    private final TravelAnalyticsMetricCache metricCache;

    @Autowired
    public TravelAnalyticsMetricService(
            TravelAnalyticsRecordRepository recordRepository,
            TravelAnalyticsMetricCalculator metricCalculator,
            TravelAnalyticsAiConfigService aiConfigService,
            TravelAnalyticsMetricCache metricCache) {
        this.recordRepository = Objects.requireNonNull(recordRepository, "recordRepository");
        this.metricCalculator = Objects.requireNonNull(metricCalculator, "metricCalculator");
        this.aiConfigService = Objects.requireNonNull(aiConfigService, "aiConfigService");
        this.metricCache = Objects.requireNonNull(metricCache, "metricCache");
    }

    TravelAnalyticsMetricService(
            TravelAnalyticsRecordRepository recordRepository,
            TravelAnalyticsValueParser valueParser,
            TravelAnalyticsAiConfigService aiConfigService) {
        this(
                recordRepository,
                new TravelAnalyticsMetricCalculator(valueParser),
                aiConfigService,
                new TravelAnalyticsMetricCache()
        );
    }

    TravelAnalyticsMetricService(
            TravelAnalyticsRecordRepository recordRepository,
            TravelAnalyticsValueParser valueParser,
            TravelAnalyticsAiConfigService aiConfigService,
            TravelAnalyticsMetricCache metricCache) {
        this(
                recordRepository,
                new TravelAnalyticsMetricCalculator(valueParser),
                aiConfigService,
                metricCache
        );
    }

    TravelAnalyticsMetricService(
            TravelAnalyticsRecordRepository recordRepository,
            TravelAnalyticsValueParser valueParser,
            TravelAnalyticsAiConfigService aiConfigService,
            Clock clock) {
        this(
                recordRepository,
                new TravelAnalyticsMetricCalculator(valueParser, clock),
                aiConfigService,
                new TravelAnalyticsMetricCache(clock)
        );
    }

    public TravelAnalyticsMetricResponse queryMetric(TravelAnalyticsAudience audience, TravelAnalyticsMetric metric) {
        if (audience == TravelAnalyticsAudience.PUBLIC && !PUBLIC_METRICS.contains(metric)) {
            throw new IllegalArgumentException("Unsupported public travel analytics metric: " + metric);
        }
        if (audience == TravelAnalyticsAudience.PUBLIC && !publicAccessEnabled()) {
            throw new ResponseStatusException(NOT_FOUND, "统计接口未开放");
        }

        return metricCache.getOrCompute(audience, metric, () -> computeMetric(audience, metric));
    }

    private TravelAnalyticsMetricResponse computeMetric(TravelAnalyticsAudience audience, TravelAnalyticsMetric metric) {
        List<TravelAnalyticsRecord> records = recordRepository.findAllByOrderByUpdatedAtAscIdAsc();
        int publicMinimumSampleSize = audience == TravelAnalyticsAudience.PUBLIC && isBreakdownMetric(metric)
                ? publicMinimumSampleSize()
                : DEFAULT_PUBLIC_MINIMUM_SAMPLE_SIZE;
        return metricCalculator.calculate(audience, metric, records, publicMinimumSampleSize);
    }

    private boolean isBreakdownMetric(TravelAnalyticsMetric metric) {
        return metric == TravelAnalyticsMetric.POPULAR_ATTRACTIONS
                || metric == TravelAnalyticsMetric.COMMON_VISITOR_SEGMENTS;
    }

    private int publicMinimumSampleSize() {
        TravelAnalyticsAiConfig config = aiConfigService.getConfig();
        Integer configuredMinimum = config.getMinimumSampleSize();
        return configuredMinimum == null || configuredMinimum < 1
                ? DEFAULT_PUBLIC_MINIMUM_SAMPLE_SIZE
                : configuredMinimum;
    }

    private boolean publicAccessEnabled() {
        return !Boolean.FALSE.equals(aiConfigService.getConfig().getPublicEnabled());
    }
}
