package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.RagEvalRun;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RagEvalRunRepository extends JpaRepository<RagEvalRun, Long> {
    List<RagEvalRun> findTop50ByOrderByCreatedAtDesc();
}
