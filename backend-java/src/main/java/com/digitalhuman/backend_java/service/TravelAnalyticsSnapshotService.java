package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.dto.TravelAnalyticsSnapshotResponse;
import com.digitalhuman.backend_java.dto.TravelAnalyticsSnapshotStatus;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.TravelAnalyticsMetricSnapshot;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatch;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatchStatus;
import com.digitalhuman.backend_java.model.TravelAnalyticsSourceState;
import com.digitalhuman.backend_java.repository.TravelAnalyticsMetricSnapshotRepository;
import com.digitalhuman.backend_java.repository.TravelAnalyticsRecordRepository;
import com.digitalhuman.backend_java.repository.TravelAnalyticsSnapshotBatchRepository;
import com.digitalhuman.backend_java.repository.TravelAnalyticsSourceStateRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class TravelAnalyticsSnapshotService {

    private static final long SOURCE_STATE_ID = 1L;
    private static final int MAX_FAILURE_SUMMARY_LENGTH = 500;
    private static final TypeReference<List<TravelAnalyticsMetricResponse.Item>> ITEMS_TYPE =
            new TypeReference<>() {
            };

    private final TravelAnalyticsSnapshotLifecycleService lifecycleService;
    private final TravelAnalyticsSnapshotTransactionService transactionService;
    private final TravelAnalyticsSnapshotBatchRepository batchRepository;
    private final TravelAnalyticsMetricSnapshotRepository metricSnapshotRepository;
    private final TravelAnalyticsSourceStateRepository sourceStateRepository;
    private final TravelAnalyticsRecordRepository recordRepository;
    private final ObjectMapper objectMapper;

    public TravelAnalyticsSnapshotService(
            TravelAnalyticsSnapshotLifecycleService lifecycleService,
            TravelAnalyticsSnapshotTransactionService transactionService,
            TravelAnalyticsSnapshotBatchRepository batchRepository,
            TravelAnalyticsMetricSnapshotRepository metricSnapshotRepository,
            TravelAnalyticsSourceStateRepository sourceStateRepository,
            TravelAnalyticsRecordRepository recordRepository,
            ObjectMapper objectMapper) {
        this.lifecycleService = Objects.requireNonNull(lifecycleService, "lifecycleService");
        this.transactionService = Objects.requireNonNull(transactionService, "transactionService");
        this.batchRepository = Objects.requireNonNull(batchRepository, "batchRepository");
        this.metricSnapshotRepository = Objects.requireNonNull(metricSnapshotRepository, "metricSnapshotRepository");
        this.sourceStateRepository = Objects.requireNonNull(sourceStateRepository, "sourceStateRepository");
        this.recordRepository = Objects.requireNonNull(recordRepository, "recordRepository");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    }

    public TravelAnalyticsSnapshotResponse refresh(AuthSession admin) {
        TravelAnalyticsSnapshotBatch batch = lifecycleService.createBuilding(admin);
        try {
            transactionService.populateAndPublish(batch.getId());
        } catch (RuntimeException failure) {
            try {
                lifecycleService.markFailed(batch.getId(), summarizeFailure(failure));
            } catch (RuntimeException markFailure) {
                failure.addSuppressed(markFailure);
            }
            throw failure;
        }
        return getLatestSnapshot();
    }

    @Transactional(readOnly = true)
    public TravelAnalyticsSnapshotResponse getLatestSnapshot() {
        Optional<TravelAnalyticsSnapshotBatch> ready = latestReady();
        Optional<TravelAnalyticsSnapshotBatch> building = latestBuilding();
        if (ready.isEmpty() && building.isEmpty()) {
            return new TravelAnalyticsSnapshotResponse(
                    TravelAnalyticsSnapshotStatus.NOT_CREATED,
                    null, null, null, null, null, null, List.of(), latestFailureAfter(null));
        }

        TravelAnalyticsSnapshotBatch displayed = ready.orElseGet(building::orElseThrow);
        TravelAnalyticsSnapshotStatus status = building.isPresent()
                ? TravelAnalyticsSnapshotStatus.REFRESHING
                : snapshotStatus(displayed);
        List<TravelAnalyticsMetricResponse> adminMetrics = ready.isPresent()
                ? loadCompleteBatch(ready.orElseThrow()).stream()
                        .filter(metric -> metric.scope() == TravelAnalyticsAudience.ADMIN)
                        .toList()
                : List.of();
        return new TravelAnalyticsSnapshotResponse(
                status,
                displayed.getId(),
                displayed.getCreatedAt(),
                displayed.getCompletedAt(),
                displayCreator(displayed),
                displayed.getSourceRecordCount(),
                recordRepository.count(),
                adminMetrics,
                latestFailureAfter(displayed.getId()));
    }

    @Transactional(readOnly = true)
    public TravelAnalyticsMetricResponse getMetric(
            TravelAnalyticsAudience audience,
            TravelAnalyticsMetric metric) {
        TravelAnalyticsSnapshotBatch ready = latestReady()
                .orElseThrow(() -> new ResponseStatusException(
                        SERVICE_UNAVAILABLE, "统计快照尚未生成"));
        return loadCompleteBatch(ready).stream()
                .filter(response -> response.scope() == audience)
                .filter(response -> response.metric() == metric)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("统计快照指标不完整"));
    }

    private Optional<TravelAnalyticsSnapshotBatch> latestReady() {
        return batchRepository.findFirstByStatusOrderByCompletedAtDescIdDesc(
                TravelAnalyticsSnapshotBatchStatus.READY);
    }

    private Optional<TravelAnalyticsSnapshotBatch> latestBuilding() {
        return batchRepository.findFirstByStatusOrderByCreatedAtDescIdDesc(
                TravelAnalyticsSnapshotBatchStatus.BUILDING);
    }

    private TravelAnalyticsSnapshotStatus snapshotStatus(TravelAnalyticsSnapshotBatch batch) {
        TravelAnalyticsSourceState state = sourceStateRepository.findById(SOURCE_STATE_ID).orElse(null);
        if (state == null) {
            return TravelAnalyticsSnapshotStatus.STALE;
        }
        boolean stale = !Objects.equals(batch.getSourceDataVersion(), state.getDataVersion())
                || !Objects.equals(batch.getMetricConfigVersion(), state.getMetricConfigVersion());
        return stale ? TravelAnalyticsSnapshotStatus.STALE : TravelAnalyticsSnapshotStatus.READY;
    }

    private List<TravelAnalyticsMetricResponse> loadCompleteBatch(TravelAnalyticsSnapshotBatch batch) {
        List<TravelAnalyticsMetricSnapshot> snapshots =
                metricSnapshotRepository.findByBatchIdOrderByScopeAscMetricAsc(batch.getId());
        int expectedCount = TravelAnalyticsAudience.values().length * TravelAnalyticsMetric.values().length;
        Set<MetricKey> keys = new HashSet<>();
        List<TravelAnalyticsMetricResponse> responses = new ArrayList<>(snapshots.size());
        for (TravelAnalyticsMetricSnapshot snapshot : snapshots) {
            keys.add(new MetricKey(snapshot.getScope(), snapshot.getMetric()));
            responses.add(toResponse(snapshot));
        }
        if (snapshots.size() != expectedCount || keys.size() != expectedCount) {
            throw new IllegalStateException("统计快照指标不完整");
        }
        return List.copyOf(responses);
    }

    private TravelAnalyticsMetricResponse toResponse(TravelAnalyticsMetricSnapshot snapshot) {
        return new TravelAnalyticsMetricResponse(
                snapshot.getMetric(),
                snapshot.getScope(),
                snapshot.getTotalSamples(),
                snapshot.getValidSamples(),
                snapshot.getAsOf(),
                deserializeItems(snapshot.getItemsJson()),
                snapshot.getMethodology(),
                snapshot.getWarning());
    }

    private List<TravelAnalyticsMetricResponse.Item> deserializeItems(String itemsJson) {
        try {
            return objectMapper.readValue(itemsJson, ITEMS_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("统计快照内容损坏", exception);
        }
    }

    private String displayCreator(TravelAnalyticsSnapshotBatch batch) {
        if (batch.getCreatedByDisplayName() != null && !batch.getCreatedByDisplayName().isBlank()) {
            return batch.getCreatedByDisplayName();
        }
        return batch.getCreatedBy();
    }

    private String latestFailureAfter(Long batchId) {
        return batchRepository.findFirstByStatusOrderByCreatedAtDescIdDesc(
                        TravelAnalyticsSnapshotBatchStatus.FAILED)
                .filter(failed -> batchId == null || failed.getId() > batchId)
                .map(TravelAnalyticsSnapshotBatch::getFailureSummary)
                .orElse(null);
    }

    private String summarizeFailure(RuntimeException failure) {
        String summary = "统计快照生成失败（" + failure.getClass().getSimpleName() + "）";
        if (failure instanceof IllegalStateException
                && failure.getMessage() != null
                && failure.getMessage().startsWith("统计快照")) {
            summary = failure.getMessage();
        }
        summary = summary.replaceAll("[\\r\\n\\t]+", " ").trim();
        return summary.length() <= MAX_FAILURE_SUMMARY_LENGTH
                ? summary
                : summary.substring(0, MAX_FAILURE_SUMMARY_LENGTH);
    }

    private record MetricKey(TravelAnalyticsAudience scope, TravelAnalyticsMetric metric) {
    }
}
