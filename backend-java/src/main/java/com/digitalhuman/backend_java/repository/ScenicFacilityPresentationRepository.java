package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.ScenicFacilityPresentation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ScenicFacilityPresentationRepository extends JpaRepository<ScenicFacilityPresentation, Long> {
    Optional<ScenicFacilityPresentation> findByFacilityId(Long facilityId);
}
