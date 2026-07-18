package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.ScenicFacilityDetail;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ScenicFacilityDetailRepository extends JpaRepository<ScenicFacilityDetail, Long> {
    Optional<ScenicFacilityDetail> findByFacilityId(Long facilityId);
}
