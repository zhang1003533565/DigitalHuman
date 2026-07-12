package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.LiveBroadcastVersionItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LiveBroadcastVersionItemRepository extends JpaRepository<LiveBroadcastVersionItem, Long> {

    List<LiveBroadcastVersionItem> findByVersionIdOrderBySortOrderAscIdAsc(Long versionId);
}
