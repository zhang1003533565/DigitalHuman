package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.ScenicStructuredSpotRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ScenicStructuredSpotRecordRepository extends JpaRepository<ScenicStructuredSpotRecord, Long> {

    List<ScenicStructuredSpotRecord> findAllByOrderByIdAsc();

    @Query("SELECT r FROM ScenicStructuredSpotRecord r WHERE LOWER(r.spot_id) = LOWER(:spotId)")
    Optional<ScenicStructuredSpotRecord> findBySpot_idIgnoreCase(@Param("spotId") String spotId);

    @Query("SELECT r FROM ScenicStructuredSpotRecord r WHERE LOWER(r.spot_id) = LOWER(:spotId) AND r.id <> :id")
    Optional<ScenicStructuredSpotRecord> findBySpot_idIgnoreCaseAndIdNot(@Param("spotId") String spotId, @Param("id") Long id);
}
