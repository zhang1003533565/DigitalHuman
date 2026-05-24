package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.GuideMessage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GuideMessageRepository extends JpaRepository<GuideMessage, Long> {

    List<GuideMessage> findBySessionIdOrderByCreatedAtAsc(String sessionId);
}
