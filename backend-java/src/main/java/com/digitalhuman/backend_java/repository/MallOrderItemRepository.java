package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.MallOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface MallOrderItemRepository extends JpaRepository<MallOrderItem, Long> {

    List<MallOrderItem> findByOrderIdOrderByIdAsc(String orderId);

    List<MallOrderItem> findByOrderIdInOrderByIdAsc(Collection<String> orderIds);
}
