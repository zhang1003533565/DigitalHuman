package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.TravelAnalyticsRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TravelAnalyticsRecordRepository extends JpaRepository<TravelAnalyticsRecord, Long> {

    List<TravelAnalyticsRecord> findAllByOrderByIdAsc();

    List<TravelAnalyticsRecord> findAllByOrderByUpdatedAtAscIdAsc();

    @Query("SELECT r FROM TravelAnalyticsRecord r WHERE LOWER(r.tourist_id) = LOWER(:touristId)")
    Optional<TravelAnalyticsRecord> findByTourist_idIgnoreCase(@Param("touristId") String touristId);

    @Query("SELECT r FROM TravelAnalyticsRecord r WHERE LOWER(r.tourist_id) = LOWER(:touristId) AND r.id <> :id")
    Optional<TravelAnalyticsRecord> findByTourist_idIgnoreCaseAndIdNot(@Param("touristId") String touristId, @Param("id") Long id);
}
