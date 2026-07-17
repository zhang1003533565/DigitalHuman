package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.FacilityCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface FacilityCategoryRepository extends JpaRepository<FacilityCategory, Long> {

    List<FacilityCategory> findAllByDeletedAtIsNullOrderBySortOrderAscIdAsc();

    @Query("""
            select category
            from FacilityCategory category
            where category.deletedAt is null
              and (category.mapVisible = true or category.mapVisible is null)
            order by category.sortOrder asc, category.id asc
            """)
    List<FacilityCategory> findMapVisibleCategories();

    Optional<FacilityCategory> findByIdAndDeletedAtIsNull(Long id);

    boolean existsByNameIgnoreCaseAndDeletedAtIsNull(String name);

    boolean existsByNameIgnoreCaseAndDeletedAtIsNullAndIdNot(String name, Long id);
}
