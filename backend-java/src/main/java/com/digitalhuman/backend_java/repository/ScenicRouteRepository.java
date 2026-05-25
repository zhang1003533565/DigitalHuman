package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.ScenicRoute;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ScenicRouteRepository extends JpaRepository<ScenicRoute, String> {
    List<ScenicRoute> findByEnabledTrueOrderBySortOrderAsc();

    List<ScenicRoute> findAllByOrderBySortOrderAsc();
}
