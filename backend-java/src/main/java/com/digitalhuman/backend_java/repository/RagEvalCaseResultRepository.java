package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.RagEvalCaseResult;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RagEvalCaseResultRepository extends JpaRepository<RagEvalCaseResult, Long> {
    List<RagEvalCaseResult> findByRunIdOrderByCaseIdAsc(Long runId);
}
