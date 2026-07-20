package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.TravelAnalyticsMetricSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TravelAnalyticsMetricSnapshotRepository extends JpaRepository<TravelAnalyticsMetricSnapshot, Long> {

    List<TravelAnalyticsMetricSnapshot> findByBatchIdOrderByScopeAscMetricAsc(Long batchId);
}
