package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.LiveBroadcastVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LiveBroadcastVersionRepository extends JpaRepository<LiveBroadcastVersion, Long> {

    Optional<LiveBroadcastVersion> findFirstByOrderByPublishedAtDescIdDesc();
}
