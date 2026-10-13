package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.MallOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MallOrderRepository extends JpaRepository<MallOrder, String> {

    List<MallOrder> findAllByOrderByCreatedAtDescIdDesc();

    List<MallOrder> findByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    Optional<MallOrder> findByIdAndUserId(String id, Long userId);

    long countByStatus(String status);
}
