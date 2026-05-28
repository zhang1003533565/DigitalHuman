package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.HomeConfig;
import com.digitalhuman.backend_java.model.HomeConfigType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HomeConfigRepository extends JpaRepository<HomeConfig, String> {

    List<HomeConfig> findByTypeOrderBySortOrderAsc(HomeConfigType type);

    List<HomeConfig> findByTypeAndEnabledTrueOrderBySortOrderAsc(HomeConfigType type);

    List<HomeConfig> findByEnabledTrueOrderByTypeAscSortOrderAsc();
}
