package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.FacilityCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FacilityCategoryRepository extends JpaRepository<FacilityCategory, Long> {

    List<FacilityCategory> findAllByDeletedAtIsNullOrderBySortOrderAscIdAsc();

    Optional<FacilityCategory> findByIdAndDeletedAtIsNull(Long id);

    boolean existsByNameIgnoreCaseAndDeletedAtIsNull(String name);

    boolean existsByNameIgnoreCaseAndDeletedAtIsNullAndIdNot(String name, Long id);
}
