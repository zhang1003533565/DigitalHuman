package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.GuideMessage;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GuideMessageRepository extends JpaRepository<GuideMessage, Long> {

    List<GuideMessage> findBySessionIdOrderByCreatedAtAsc(String sessionId);

    @Query("select count(message) from GuideMessage message")
    long countPersistedMessages();

    @Query("select count(message) from GuideMessage message where lower(message.role) = 'assistant'")
    long countAssistantMessages();

    @Query("select count(message) from GuideMessage message "
            + "where lower(message.role) = 'assistant' and message.knowledgeHit = true")
    long countKnowledgeHitAssistantMessages();

    @Query("select count(message) from GuideMessage message where message.createdAt >= :start and message.createdAt < :end")
    long countByCreatedAtBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("select count(message) from GuideMessage message where lower(message.role) = 'assistant' and message.createdAt >= :start and message.createdAt < :end")
    long countAssistantMessagesByCreatedAtBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("select count(message) from GuideMessage message "
            + "where lower(message.role) = 'assistant' and message.knowledgeHit = true "
            + "and message.createdAt >= :start and message.createdAt < :end")
    long countKnowledgeHitAssistantMessagesByCreatedAtBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
