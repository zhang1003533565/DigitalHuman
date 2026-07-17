package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.GuideSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface GuideSessionRepository extends JpaRepository<GuideSession, String> {
    List<GuideSession> findAllByOrderByUpdatedAtDesc();

    @Query("select count(session) from GuideSession session")
    long countPersistedSessions();

    @Query("select count(session) from GuideSession session where session.createdAt >= :start and session.createdAt < :end")
    long countByCreatedAtBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
