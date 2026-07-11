package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.GuideMessage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface GuideMessageRepository extends JpaRepository<GuideMessage, Long> {

    List<GuideMessage> findBySessionIdOrderByCreatedAtAsc(String sessionId);

    @Query("select count(message) from GuideMessage message")
    long countPersistedMessages();

    @Query("select count(message) from GuideMessage message where lower(message.role) = 'assistant'")
    long countAssistantMessages();

    @Query("select count(message) from GuideMessage message "
            + "where lower(message.role) = 'assistant' and message.knowledgeHit = true")
    long countKnowledgeHitAssistantMessages();
}
