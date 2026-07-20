package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.model.TravelAnalyticsAiConfig;
import com.digitalhuman.backend_java.model.TravelAnalyticsMetricSnapshot;
import com.digitalhuman.backend_java.model.TravelAnalyticsRecord;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatch;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatchStatus;
import com.digitalhuman.backend_java.model.TravelAnalyticsSourceState;
import com.digitalhuman.backend_java.repository.TravelAnalyticsMetricSnapshotRepository;
import com.digitalhuman.backend_java.repository.TravelAnalyticsRecordRepository;
import com.digitalhuman.backend_java.repository.TravelAnalyticsSnapshotBatchRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
public class TravelAnalyticsSnapshotTransactionService {

    private static final int DEFAULT_MINIMUM_SAMPLE_SIZE = 10;

    private final TravelAnalyticsSnapshotBatchRepository batchRepository;
    private final TravelAnalyticsMetricSnapshotRepository metricSnapshotRepository;
    private final TravelAnalyticsRecordRepository recordRepository;
    private final TravelAnalyticsSourceStateService sourceStateService;
    private final TravelAnalyticsAiConfigService aiConfigService;
    private final TravelAnalyticsMetricCalculator calculator;
    private final ObjectMapper objectMapper;

    public TravelAnalyticsSnapshotTransactionService(
            TravelAnalyticsSnapshotBatchRepository batchRepository,
            TravelAnalyticsMetricSnapshotRepository metricSnapshotRepository,
            TravelAnalyticsRecordRepository recordRepository,
            TravelAnalyticsSourceStateService sourceStateService,
            TravelAnalyticsAiConfigService aiConfigService,
            TravelAnalyticsMetricCalculator calculator,
            ObjectMapper objectMapper) {
        this.batchRepository = Objects.requireNonNull(batchRepository, "batchRepository");
        this.metricSnapshotRepository = Objects.requireNonNull(metricSnapshotRepository, "metricSnapshotRepository");
        this.recordRepository = Objects.requireNonNull(recordRepository, "recordRepository");
        this.sourceStateService = Objects.requireNonNull(sourceStateService, "sourceStateService");
        this.aiConfigService = Objects.requireNonNull(aiConfigService, "aiConfigService");
        this.calculator = Objects.requireNonNull(calculator, "calculator");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    }

    @Transactional
    public void populateAndPublish(Long batchId) {
        TravelAnalyticsSourceState state = sourceStateService.lockState();
        TravelAnalyticsSnapshotBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalStateException("统计快照批次不存在"));
        if (batch.getStatus() != TravelAnalyticsSnapshotBatchStatus.BUILDING) {
            throw new IllegalStateException("统计快照批次状态无效");
        }

        List<TravelAnalyticsRecord> records = recordRepository.findAllByOrderByUpdatedAtAscIdAsc();
        TravelAnalyticsAiConfig config = aiConfigService.getConfig();
        int minimumSampleSize = validMinimumSampleSize(config);
        List<MetricResult> results = calculateAll(records, minimumSampleSize);
        assertCompleteResults(results);

        List<TravelAnalyticsMetricSnapshot> snapshots = results.stream()
                .map(result -> toSnapshot(batch, result))
                .toList();
        metricSnapshotRepository.saveAllAndFlush(snapshots);
        assertCompleteRows(batchId);

        TravelAnalyticsSourceStateService.Versions versions = sourceStateService.versionsOf(state);
        batch.setSourceDataVersion(versions.dataVersion());
        batch.setMetricConfigVersion(versions.metricConfigVersion());
        batch.setSourceRecordCount((long) records.size());
        batch.setSourceMaxUpdatedAt(maxUpdatedAt(records));
        batch.setFailureSummary(null);
        batch.setCompletedAt(LocalDateTime.now());
        batch.setStatus(TravelAnalyticsSnapshotBatchStatus.READY);
        batchRepository.saveAndFlush(batch);
    }

    private List<MetricResult> calculateAll(List<TravelAnalyticsRecord> records, int minimumSampleSize) {
        List<MetricResult> results = new ArrayList<>();
        for (TravelAnalyticsAudience scope : TravelAnalyticsAudience.values()) {
            for (TravelAnalyticsMetric metric : TravelAnalyticsMetric.values()) {
                TravelAnalyticsMetricResponse response = calculator.calculate(
                        scope, metric, records, minimumSampleSize);
                results.add(new MetricResult(scope, metric, response));
            }
        }
        return results;
    }

    private void assertCompleteResults(List<MetricResult> results) {
        Set<MetricKey> keys = new HashSet<>();
        for (MetricResult result : results) {
            TravelAnalyticsMetricResponse response = result.response();
            if (response == null
                    || response.scope() != result.scope()
                    || response.metric() != result.metric()
                    || response.asOf() == null
                    || response.methodology() == null) {
                throw new IllegalStateException("统计快照指标不完整");
            }
            keys.add(new MetricKey(result.scope(), result.metric()));
        }
        if (results.size() != expectedMetricCount() || keys.size() != expectedMetricCount()) {
            throw new IllegalStateException("统计快照指标不完整");
        }
    }

    private TravelAnalyticsMetricSnapshot toSnapshot(
            TravelAnalyticsSnapshotBatch batch,
            MetricResult result) {
        TravelAnalyticsMetricResponse response = result.response();
        TravelAnalyticsMetricSnapshot snapshot = new TravelAnalyticsMetricSnapshot();
        snapshot.setBatch(batch);
        snapshot.setScope(result.scope());
        snapshot.setMetric(result.metric());
        snapshot.setItemsJson(serializeItems(response.items()));
        snapshot.setTotalSamples(response.totalSamples());
        snapshot.setValidSamples(response.validSamples());
        snapshot.setAsOf(response.asOf());
        snapshot.setMethodology(response.methodology());
        snapshot.setWarning(response.warning());
        return snapshot;
    }

    private String serializeItems(List<TravelAnalyticsMetricResponse.Item> items) {
        try {
            return objectMapper.writeValueAsString(items);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("统计快照序列化失败", exception);
        }
    }

    private void assertCompleteRows(Long batchId) {
        List<TravelAnalyticsMetricSnapshot> persisted =
                metricSnapshotRepository.findByBatchIdOrderByScopeAscMetricAsc(batchId);
        Set<MetricKey> keys = new HashSet<>();
        for (TravelAnalyticsMetricSnapshot snapshot : persisted) {
            keys.add(new MetricKey(snapshot.getScope(), snapshot.getMetric()));
        }
        if (persisted.size() != expectedMetricCount() || keys.size() != expectedMetricCount()) {
            throw new IllegalStateException("统计快照指标不完整");
        }
    }

    private int validMinimumSampleSize(TravelAnalyticsAiConfig config) {
        if (config == null || config.getMinimumSampleSize() == null || config.getMinimumSampleSize() < 1) {
            return DEFAULT_MINIMUM_SAMPLE_SIZE;
        }
        return config.getMinimumSampleSize();
    }

    private LocalDateTime maxUpdatedAt(List<TravelAnalyticsRecord> records) {
        return records.stream()
                .map(TravelAnalyticsRecord::getUpdatedAt)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElse(null);
    }

    private int expectedMetricCount() {
        return TravelAnalyticsAudience.values().length * TravelAnalyticsMetric.values().length;
    }

    private record MetricKey(TravelAnalyticsAudience scope, TravelAnalyticsMetric metric) {
    }

    private record MetricResult(
            TravelAnalyticsAudience scope,
            TravelAnalyticsMetric metric,
            TravelAnalyticsMetricResponse response) {
    }
}
