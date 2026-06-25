package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.TravelTip;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TravelTipRepository extends JpaRepository<TravelTip, String> {
    List<TravelTip> findByEnabledTrueOrderBySortOrderAsc();

    List<TravelTip> findAllByOrderBySortOrderAsc();

    List<TravelTip> findByCategoryAndEnabledTrueOrderBySortOrderAsc(String category);
}
