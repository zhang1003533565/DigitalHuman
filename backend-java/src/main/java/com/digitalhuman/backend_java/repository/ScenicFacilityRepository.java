package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.ScenicFacility;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ScenicFacilityRepository extends JpaRepository<ScenicFacility, Long> {

    List<ScenicFacility> findAllByDeletedAtIsNullOrderByUpdatedAtDescIdDesc();

    @Query("""
            select facility
            from ScenicFacility facility
            where facility.deletedAt is null
              and (facility.category.mapVisible = true or facility.category.mapVisible is null)
            order by facility.updatedAt desc, facility.id desc
            """)
    List<ScenicFacility> findMapVisibleFacilities();

    Optional<ScenicFacility> findByIdAndDeletedAtIsNull(Long id);

    boolean existsByCategory_IdAndDeletedAtIsNull(Long categoryId);
}
