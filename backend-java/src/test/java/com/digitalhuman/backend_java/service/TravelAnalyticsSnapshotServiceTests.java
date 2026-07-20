package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.dto.TravelAnalyticsSnapshotResponse;
import com.digitalhuman.backend_java.dto.TravelAnalyticsSnapshotStatus;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.TravelAnalyticsAiConfig;
import com.digitalhuman.backend_java.model.TravelAnalyticsMetricSnapshot;
import com.digitalhuman.backend_java.model.TravelAnalyticsRecord;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatch;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatchStatus;
import com.digitalhuman.backend_java.model.TravelAnalyticsSourceState;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.repository.TravelAnalyticsMetricSnapshotRepository;
import com.digitalhuman.backend_java.repository.TravelAnalyticsRecordRepository;
import com.digitalhuman.backend_java.repository.TravelAnalyticsSnapshotBatchRepository;
import com.digitalhuman.backend_java.repository.TravelAnalyticsSourceStateRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import({
        TravelAnalyticsSourceStateService.class,
        TravelAnalyticsSnapshotLifecycleService.class,
        TravelAnalyticsSnapshotTransactionService.class,
        TravelAnalyticsSnapshotService.class,
        TravelAnalyticsSnapshotServiceTests.JacksonTestConfiguration.class
})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class TravelAnalyticsSnapshotServiceTests {

    private static final long DATA_VERSION = 7L;
    private static final long CONFIG_VERSION = 3L;

    @Autowired
    private TravelAnalyticsSnapshotService service;

    @Autowired
    private TravelAnalyticsSnapshotLifecycleService lifecycleService;

    @Autowired
    private TravelAnalyticsSnapshotBatchRepository batches;

    @SpyBean
    private TravelAnalyticsMetricSnapshotRepository metricSnapshots;

    @Autowired
    private TravelAnalyticsRecordRepository records;

    @Autowired
    private TravelAnalyticsSourceStateRepository sourceStates;

    @SpyBean
    private TravelAnalyticsSourceStateService sourceStateService;

    @MockBean
    private TravelAnalyticsMetricCalculator calculator;

    @MockBean
    private TravelAnalyticsAiConfigService configService;

    @BeforeEach
    void setUp() {
        metricSnapshots.deleteAll();
        batches.deleteAll();
        records.deleteAll();
        sourceStates.deleteAll();

        TravelAnalyticsSourceState state = new TravelAnalyticsSourceState();
        state.setId(1L);
        state.setDataVersion(DATA_VERSION);
        state.setMetricConfigVersion(CONFIG_VERSION);
        sourceStates.saveAndFlush(state);

        TravelAnalyticsAiConfig config = new TravelAnalyticsAiConfig();
        config.setId("default");
        config.setPublicEnabled(true);
        config.setMinimumSampleSize(10);
        reset(calculator, configService, sourceStateService);
        when(configService.getConfig()).thenReturn(config);
        stubCompleteCalculations();
    }

    @Test
    void noSnapshotIsExplicitAndMetricReadNeverFallsBackToLiveAggregation() {
        TravelAnalyticsSnapshotResponse response = service.getLatestSnapshot();

        assertEquals(TravelAnalyticsSnapshotStatus.NOT_CREATED, response.status());
        assertNull(response.batchId());
        assertNull(response.createdAt());
        assertNull(response.completedAt());
        assertNull(response.createdBy());
        assertNull(response.sourceRecordCount());
        assertNull(response.currentRecordCount());
        assertTrue(response.metrics().isEmpty());
        assertNull(response.failureMessage());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.getMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND));
        assertEquals(503, exception.getStatusCode().value());
        assertEquals("统计快照尚未生成", exception.getReason());
        verifyNoInteractions(calculator);
    }

    @Test
    void refreshAtomicallyPublishesTenUniqueLosslessMetricsAndAuditWatermarks() {
        TravelAnalyticsRecord record = records.saveAndFlush(record("tourist-1"));

        TravelAnalyticsSnapshotResponse response = service.refresh(admin());

        assertEquals(TravelAnalyticsSnapshotStatus.READY, response.status());
        assertNotNull(response.batchId());
        assertEquals(1L, response.sourceRecordCount());
        assertEquals(1L, response.currentRecordCount());
        assertEquals("管理员", response.createdBy());
        assertEquals(5, response.metrics().size());

        List<TravelAnalyticsMetricSnapshot> persisted =
                metricSnapshots.findByBatchIdOrderByScopeAscMetricAsc(response.batchId());
        assertEquals(10, persisted.size());
        assertEquals(10, persisted.stream()
                .map(snapshot -> snapshot.getScope() + ":" + snapshot.getMetric())
                .distinct()
                .count());
        assertTrue(persisted.stream().allMatch(snapshot -> snapshot.getItemsJson().startsWith("[{\"label\"")));
        assertTrue(persisted.stream().noneMatch(snapshot -> snapshot.getItemsJson().contains("methodology")));

        TravelAnalyticsSnapshotBatch batch = batches.findById(response.batchId()).orElseThrow();
        assertEquals(TravelAnalyticsSnapshotBatchStatus.READY, batch.getStatus());
        assertEquals(DATA_VERSION, batch.getSourceDataVersion());
        assertEquals(CONFIG_VERSION, batch.getMetricConfigVersion());
        assertEquals(1L, batch.getSourceRecordCount());
        assertEquals(record.getUpdatedAt(), batch.getSourceMaxUpdatedAt());
        assertEquals("admin", batch.getCreatedBy());
        assertEquals("管理员", batch.getCreatedByDisplayName());
        assertNotNull(batch.getCompletedAt());

        TravelAnalyticsMetricResponse metric = service.getMetric(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND);
        assertEquals(TravelAnalyticsMetric.AVERAGE_SPEND, metric.metric());
        assertEquals(TravelAnalyticsAudience.PUBLIC, metric.scope());
        assertEquals(1L, metric.totalSamples());
        assertEquals(1L, metric.validSamples());
        assertEquals(record.getUpdatedAt(), metric.asOf());
        assertEquals("method-PUBLIC-AVERAGE_SPEND", metric.methodology());
        assertEquals("warning-PUBLIC-AVERAGE_SPEND", metric.warning());
        assertEquals(List.of(new TravelAnalyticsMetricResponse.Item(
                "PUBLIC-AVERAGE_SPEND", BigDecimal.TEN)), metric.items());
        verify(calculator, times(10)).calculate(any(), any(), anyList(), anyInt());
    }

    @Test
    void changedSourceOrMetricConfigMarksOldReadySnapshotStaleWithoutChangingItsMetrics() {
        records.saveAndFlush(record("tourist-1"));
        Long readyBatchId = service.refresh(admin()).batchId();
        TravelAnalyticsMetricResponse before = service.getMetric(
                TravelAnalyticsAudience.ADMIN,
                TravelAnalyticsMetric.AVERAGE_SPEND);

        TravelAnalyticsSourceState state = sourceStates.findById(1L).orElseThrow();
        state.setDataVersion(DATA_VERSION + 1);
        state.setMetricConfigVersion(CONFIG_VERSION + 1);
        sourceStates.saveAndFlush(state);

        TravelAnalyticsSnapshotResponse response = service.getLatestSnapshot();

        assertEquals(TravelAnalyticsSnapshotStatus.STALE, response.status());
        assertEquals(readyBatchId, response.batchId());
        assertEquals(before, service.getMetric(
                TravelAnalyticsAudience.ADMIN,
                TravelAnalyticsMetric.AVERAGE_SPEND));
        verify(calculator, times(10)).calculate(any(), any(), anyList(), anyInt());
    }

    @Test
    void buildingWithoutReadyReturnsRefreshingAndSecondRefreshConflicts() {
        TravelAnalyticsSnapshotBatch building = lifecycleService.createBuilding(admin());

        TravelAnalyticsSnapshotResponse response = service.getLatestSnapshot();

        assertEquals(TravelAnalyticsSnapshotStatus.REFRESHING, response.status());
        assertEquals(building.getId(), response.batchId());
        assertEquals("管理员", response.createdBy());
        assertTrue(response.metrics().isEmpty());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.refresh(admin()));
        assertEquals(409, exception.getStatusCode().value());
        assertEquals("统计快照正在生成", exception.getReason());
        assertEquals(1, batches.findAll().size());
        verifyNoInteractions(calculator);
    }

    @Test
    void refreshMapsSourceStateLockContentionToConflictWithoutCreatingBatch() {
        doThrow(new CannotAcquireLockException("lock busy"))
                .when(sourceStateService).lockState();

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.refresh(admin()));

        assertEquals(409, exception.getStatusCode().value());
        assertEquals("统计快照正在生成", exception.getReason());
        assertTrue(batches.findAll().isEmpty());
        verifyNoInteractions(calculator);
    }

    @Test
    void buildingKeepsPreviousReadyMetricsReadableAsRefreshing() {
        records.saveAndFlush(record("tourist-1"));
        TravelAnalyticsSnapshotResponse ready = service.refresh(admin());
        TravelAnalyticsMetricResponse publishedMetric = service.getMetric(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND);

        lifecycleService.createBuilding(admin());

        TravelAnalyticsSnapshotResponse refreshing = service.getLatestSnapshot();
        assertEquals(TravelAnalyticsSnapshotStatus.REFRESHING, refreshing.status());
        assertEquals(ready.batchId(), refreshing.batchId());
        assertEquals(5, refreshing.metrics().size());
        assertEquals(publishedMetric, service.getMetric(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND));
    }

    @Test
    void failedWriteRollsBackAllMetricsMarksBatchFailedAndPreservesOldReady() {
        records.saveAndFlush(record("tourist-1"));
        TravelAnalyticsSnapshotResponse ready = service.refresh(admin());
        TravelAnalyticsMetricResponse publishedMetric = service.getMetric(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND);

        doAnswer(invocation -> {
            List<TravelAnalyticsMetricSnapshot> attempted = invocation.getArgument(0);
            attempted.stream().limit(5).forEach(metricSnapshots::save);
            metricSnapshots.flush();
            throw new IllegalStateException("snapshot write failed");
        }).when(metricSnapshots).saveAllAndFlush(anyList());

        IllegalStateException writeFailure = assertThrows(
                IllegalStateException.class,
                () -> service.refresh(admin()));
        assertEquals("snapshot write failed", writeFailure.getMessage());

        TravelAnalyticsSnapshotBatch failed = batches
                .findFirstByStatusOrderByCreatedAtDescIdDesc(TravelAnalyticsSnapshotBatchStatus.FAILED)
                .orElseThrow();
        assertNotNull(failed.getCompletedAt());
        assertNotNull(failed.getFailureSummary());
        assertTrue(failed.getFailureSummary().length() <= 500);
        assertTrue(metricSnapshots.findByBatchIdOrderByScopeAscMetricAsc(failed.getId()).isEmpty());

        TravelAnalyticsSnapshotResponse latest = service.getLatestSnapshot();
        assertEquals(TravelAnalyticsSnapshotStatus.READY, latest.status());
        assertEquals(ready.batchId(), latest.batchId());
        assertNotNull(latest.failureMessage());
        assertEquals(publishedMetric, service.getMetric(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND));
    }

    @Test
    void incompleteCalculatorCombinationCannotPublishPartialBatch() {
        records.saveAndFlush(record("tourist-1"));
        doAnswer(invocation -> {
            TravelAnalyticsAudience audience = invocation.getArgument(0);
            TravelAnalyticsMetric metric = invocation.getArgument(1);
            List<TravelAnalyticsRecord> source = invocation.getArgument(2);
            if (audience == TravelAnalyticsAudience.ADMIN
                    && metric == TravelAnalyticsMetric.AVERAGE_SPEND) {
                return response(audience, TravelAnalyticsMetric.AVERAGE_SATISFACTION, source);
            }
            return response(audience, metric, source);
        }).when(calculator).calculate(any(), any(), anyList(), anyInt());

        IllegalStateException exception = assertThrows(
                IllegalStateException.class,
                () -> service.refresh(admin()));

        assertEquals("统计快照指标不完整", exception.getMessage());
        TravelAnalyticsSnapshotBatch failed = batches
                .findFirstByStatusOrderByCreatedAtDescIdDesc(TravelAnalyticsSnapshotBatchStatus.FAILED)
                .orElseThrow();
        assertTrue(metricSnapshots.findByBatchIdOrderByScopeAscMetricAsc(failed.getId()).isEmpty());
        assertTrue(batches.findFirstByStatusOrderByCompletedAtDescIdDesc(
                TravelAnalyticsSnapshotBatchStatus.READY).isEmpty());
    }

    @Test
    void malformedItemsJsonFailsExplicitlyInsteadOfFallingBack() {
        records.saveAndFlush(record("tourist-1"));
        Long batchId = service.refresh(admin()).batchId();
        TravelAnalyticsMetricSnapshot snapshot = metricSnapshots
                .findByBatchIdOrderByScopeAscMetricAsc(batchId)
                .stream()
                .filter(candidate -> candidate.getScope() == TravelAnalyticsAudience.PUBLIC)
                .filter(candidate -> candidate.getMetric() == TravelAnalyticsMetric.AVERAGE_SPEND)
                .findFirst()
                .orElseThrow();
        snapshot.setItemsJson("not-json");
        metricSnapshots.saveAndFlush(snapshot);

        IllegalStateException exception = assertThrows(
                IllegalStateException.class,
                () -> service.getMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND));

        assertEquals("统计快照内容损坏", exception.getMessage());
        verify(calculator, times(10)).calculate(any(), any(), anyList(), anyInt());
    }

    private void stubCompleteCalculations() {
        when(calculator.calculate(any(), any(), anyList(), anyInt())).thenAnswer(invocation -> response(
                invocation.getArgument(0),
                invocation.getArgument(1),
                invocation.getArgument(2)));
    }

    private TravelAnalyticsMetricResponse response(
            TravelAnalyticsAudience audience,
            TravelAnalyticsMetric metric,
            List<TravelAnalyticsRecord> source) {
        LocalDateTime asOf = source.stream()
                .map(TravelAnalyticsRecord::getUpdatedAt)
                .max(LocalDateTime::compareTo)
                .orElse(LocalDateTime.of(2026, 7, 20, 10, 0));
        return new TravelAnalyticsMetricResponse(
                metric,
                audience,
                source.size(),
                source.size(),
                asOf,
                List.of(new TravelAnalyticsMetricResponse.Item(
                        audience + "-" + metric.name(), BigDecimal.TEN)),
                "method-" + audience + "-" + metric.name(),
                "warning-" + audience + "-" + metric.name());
    }

    private TravelAnalyticsRecord record(String touristId) {
        TravelAnalyticsRecord record = new TravelAnalyticsRecord();
        record.setTourist_id(touristId);
        record.setUser_nickname("游客");
        record.setAttraction_name("灵山胜境");
        record.setTotal_cost("100");
        return record;
    }

    private AuthSession admin() {
        return new AuthSession(1L, "admin", "管理员", UserRole.ADMIN);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class JacksonTestConfiguration {

        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }
    }
}
