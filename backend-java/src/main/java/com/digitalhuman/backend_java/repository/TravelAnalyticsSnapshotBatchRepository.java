package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatch;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TravelAnalyticsSnapshotBatchRepository extends JpaRepository<TravelAnalyticsSnapshotBatch, Long> {

    Optional<TravelAnalyticsSnapshotBatch> findFirstByStatusOrderByCompletedAtDescIdDesc(TravelAnalyticsSnapshotBatchStatus status);

    Optional<TravelAnalyticsSnapshotBatch> findFirstByStatusOrderByCreatedAtDescIdDesc(TravelAnalyticsSnapshotBatchStatus status);
}
