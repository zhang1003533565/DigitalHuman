package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.AuditLog;
import com.digitalhuman.backend_java.repository.AuditLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;

@Service
public class AuditLogService {

    private final AuditLogRepository repository;
    private final ObjectMapper objectMapper;

    public AuditLogService(AuditLogRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public void record(String actor, String action, String targetType, String targetId, Object detail) {
        AuditLog log = new AuditLog();
        log.setActor(actor == null || actor.isBlank() ? "system" : actor);
        log.setAction(action);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setDetailJson(writeJson(detail));
        log.setCreatedAt(LocalDateTime.now());
        repository.save(log);
    }

    private String writeJson(Object detail) {
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (Exception exception) {
            return "{}";
        }
    }
}
