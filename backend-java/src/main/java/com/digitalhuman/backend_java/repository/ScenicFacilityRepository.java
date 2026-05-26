package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.ScenicFacility;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ScenicFacilityRepository extends JpaRepository<ScenicFacility, Long> {

    List<ScenicFacility> findAllByDeletedAtIsNullOrderByUpdatedAtDescIdDesc();

    Optional<ScenicFacility> findByIdAndDeletedAtIsNull(Long id);

    boolean existsByCategory_IdAndDeletedAtIsNull(Long categoryId);
}
