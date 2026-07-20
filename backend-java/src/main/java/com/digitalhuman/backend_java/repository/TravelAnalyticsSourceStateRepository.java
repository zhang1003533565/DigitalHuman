package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.TravelAnalyticsSourceState;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface TravelAnalyticsSourceStateRepository extends JpaRepository<TravelAnalyticsSourceState, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "0"))
    @Query("select s from TravelAnalyticsSourceState s where s.id = :id")
    Optional<TravelAnalyticsSourceState> findLockedById(@Param("id") Long id);
}
