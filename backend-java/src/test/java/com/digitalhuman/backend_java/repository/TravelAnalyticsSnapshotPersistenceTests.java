package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatch;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatchStatus;
import com.digitalhuman.backend_java.model.TravelAnalyticsMetricSnapshot;
import com.digitalhuman.backend_java.model.TravelAnalyticsSourceState;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class TravelAnalyticsSnapshotPersistenceTests {

    @Autowired
    private TravelAnalyticsSnapshotBatchRepository batches;

    @Autowired
    private TravelAnalyticsMetricSnapshotRepository snapshots;

    @Autowired
    private TravelAnalyticsSourceStateRepository sourceStates;

    @Test
    void storesExactlyOneMetricPerBatchScopeAndMetric() {
        TravelAnalyticsSnapshotBatch batch = batches.saveAndFlush(readyBatch());

        snapshots.saveAllAndFlush(allTenSnapshots(batch));

        List<TravelAnalyticsMetricSnapshot> persisted =
                snapshots.findByBatchIdOrderByScopeAscMetricAsc(batch.getId());
        assertEquals(10, persisted.size());
        TravelAnalyticsMetricSnapshot averageSpend = persisted.stream()
                .filter(snapshot -> snapshot.getScope() == TravelAnalyticsAudience.ADMIN)
                .filter(snapshot -> snapshot.getMetric() == TravelAnalyticsMetric.AVERAGE_SPEND)
                .findFirst()
                .orElseThrow();
        assertEquals(12L, averageSpend.getTotalSamples());
        assertEquals(10L, averageSpend.getValidSamples());
        assertEquals(LocalDateTime.of(2026, 7, 20, 9, 30), averageSpend.getAsOf());
        assertEquals("items only", averageSpend.getMethodology());
        assertNull(averageSpend.getWarning());
        assertThrows(
                DataIntegrityViolationException.class,
                () -> snapshots.saveAndFlush(snapshot(batch, TravelAnalyticsAudience.ADMIN, TravelAnalyticsMetric.AVERAGE_SPEND)));
    }

    @Test
    void locksSeededSourceStateWithZeroVersions() {
        TravelAnalyticsSourceState seeded = new TravelAnalyticsSourceState();
        seeded.setId(1L);
        seeded.setDataVersion(0L);
        seeded.setMetricConfigVersion(0L);
        seeded.setUpdatedAt(LocalDateTime.now());
        sourceStates.saveAndFlush(seeded);

        TravelAnalyticsSourceState locked = sourceStates.findLockedById(1L).orElseThrow();

        assertEquals(0L, locked.getDataVersion());
        assertEquals(0L, locked.getMetricConfigVersion());
    }

    private TravelAnalyticsSnapshotBatch readyBatch() {
        TravelAnalyticsSnapshotBatch batch = new TravelAnalyticsSnapshotBatch();
        batch.setStatus(TravelAnalyticsSnapshotBatchStatus.READY);
        batch.setSourceDataVersion(7L);
        batch.setMetricConfigVersion(3L);
        batch.setFailureSummary(null);
        batch.setCreatedAt(LocalDateTime.now().minusMinutes(1));
        batch.setCompletedAt(LocalDateTime.now());
        return batch;
    }

    private List<TravelAnalyticsMetricSnapshot> allTenSnapshots(TravelAnalyticsSnapshotBatch batch) {
        return List.of(
                snapshot(batch, TravelAnalyticsAudience.ADMIN, TravelAnalyticsMetric.AVERAGE_SPEND),
                snapshot(batch, TravelAnalyticsAudience.ADMIN, TravelAnalyticsMetric.AVERAGE_STAY_DURATION),
                snapshot(batch, TravelAnalyticsAudience.ADMIN, TravelAnalyticsMetric.AVERAGE_SATISFACTION),
                snapshot(batch, TravelAnalyticsAudience.ADMIN, TravelAnalyticsMetric.POPULAR_ATTRACTIONS),
                snapshot(batch, TravelAnalyticsAudience.ADMIN, TravelAnalyticsMetric.COMMON_VISITOR_SEGMENTS),
                snapshot(batch, TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND),
                snapshot(batch, TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_STAY_DURATION),
                snapshot(batch, TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SATISFACTION),
                snapshot(batch, TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.POPULAR_ATTRACTIONS),
                snapshot(batch, TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.COMMON_VISITOR_SEGMENTS));
    }

    private TravelAnalyticsMetricSnapshot snapshot(
            TravelAnalyticsSnapshotBatch batch,
            TravelAnalyticsAudience scope,
            TravelAnalyticsMetric metric) {
        TravelAnalyticsMetricSnapshot snapshot = new TravelAnalyticsMetricSnapshot();
        snapshot.setBatch(batch);
        snapshot.setScope(scope);
        snapshot.setMetric(metric);
        snapshot.setItemsJson("[]");
        snapshot.setTotalSamples(12L);
        snapshot.setValidSamples(10L);
        snapshot.setAsOf(LocalDateTime.of(2026, 7, 20, 9, 30));
        snapshot.setMethodology("items only");
        snapshot.setWarning(null);
        return snapshot;
    }
}
