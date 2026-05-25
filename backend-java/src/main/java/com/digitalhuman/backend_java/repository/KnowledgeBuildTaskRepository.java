package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.KnowledgeBuildTask;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KnowledgeBuildTaskRepository extends JpaRepository<KnowledgeBuildTask, Long> {
    List<KnowledgeBuildTask> findTop50ByOrderByCreatedAtDesc();
}
