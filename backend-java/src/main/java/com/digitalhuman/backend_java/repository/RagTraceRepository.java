package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.RagTrace;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RagTraceRepository extends JpaRepository<RagTrace, Long> {

    List<RagTrace> findAllByOrderByCreatedAtDesc();

    Optional<RagTrace> findByTraceId(String traceId);
}
