package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.LiveScriptItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LiveScriptItemRepository extends JpaRepository<LiveScriptItem, Long> {
}
