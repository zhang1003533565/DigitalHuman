package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicKnowledgePreviewDto;
import com.digitalhuman.backend_java.dto.ScenicKnowledgePublicationDto;
import com.digitalhuman.backend_java.dto.ScenicKnowledgePublishRequest;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.ScenicFacility;
import com.digitalhuman.backend_java.model.ScenicFacilityDetail;
import com.digitalhuman.backend_java.model.ScenicKnowledgePublication;
import com.digitalhuman.backend_java.model.ScenicStructuredSpotRecord;
import com.digitalhuman.backend_java.repository.ScenicFacilityDetailRepository;
import com.digitalhuman.backend_java.repository.ScenicFacilityRepository;
import com.digitalhuman.backend_java.repository.ScenicKnowledgePublicationRepository;
import com.digitalhuman.backend_java.repository.ScenicStructuredSpotRecordRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class ScenicKnowledgePublicationService {

    private static final int MAX_UPLOAD_TASK_POLLS = 8;
    private static final Pattern AUTHORIZATION_PATTERN = Pattern.compile("(?i)authorization\\s*:\\s*bearer\\s+\\S+");
    private static final Pattern BEARER_PATTERN = Pattern.compile("(?i)bearer\\s+\\S+");
    private static final Pattern TOKEN_PATTERN = Pattern.compile("(?i)token\\s*=\\s*[^\\s,&]+");
    private static final Pattern API_KEY_PATTERN = Pattern.compile("(?i)api[_-]?key\\s*=\\s*[^\\s,&]+");

    private final ScenicStructuredSpotRecordRepository recordRepository;
    private final ScenicFacilityRepository facilityRepository;
    private final ScenicFacilityDetailRepository detailRepository;
    private final ScenicKnowledgePublicationRepository publicationRepository;
    private final ScenicKnowledgeDocumentRenderer renderer;
    private final MaxKbKnowledgeService maxKbKnowledgeService;
    private final ObjectMapper objectMapper;

    public ScenicKnowledgePublicationService(
            ScenicStructuredSpotRecordRepository recordRepository,
            ScenicFacilityRepository facilityRepository,
            ScenicFacilityDetailRepository detailRepository,
            ScenicKnowledgePublicationRepository publicationRepository,
            ScenicKnowledgeDocumentRenderer renderer,
            MaxKbKnowledgeService maxKbKnowledgeService,
            ObjectMapper objectMapper) {
        this.recordRepository = recordRepository;
        this.facilityRepository = facilityRepository;
        this.detailRepository = detailRepository;
        this.publicationRepository = publicationRepository;
        this.renderer = renderer;
        this.maxKbKnowledgeService = maxKbKnowledgeService;
        this.objectMapper = objectMapper;
    }

    public ScenicKnowledgePreviewDto preview(Long recordId) {
        ScenicStructuredSpotRecord record = requireAppliedRecord(recordId);
        ScenicFacility facility = findFacility(record.getMatchedFacilityId());
        ScenicFacilityDetail detail = detailRepository.findByFacilityId(facility.getId()).orElse(null);
        ScenicKnowledgeDocumentRenderer.RenderedDocument rendered = renderer.render(facility, detail);
        ScenicKnowledgePreviewDto dto = new ScenicKnowledgePreviewDto();
        dto.setRecordId(record.getId());
        dto.setFacilityId(facility.getId());
        dto.setFileName(rendered.fileName());
        dto.setMarkdown(rendered.markdown());
        dto.setSha256(rendered.sha256());
        dto.setContentVersion(rendered.contentVersion());
        return dto;
    }

    public ScenicKnowledgePublicationDto publish(Long recordId, ScenicKnowledgePublishRequest request, AuthSession actor) {
        ScenicStructuredSpotRecord record = requireAppliedRecord(recordId);
        ScenicFacility facility = findFacility(record.getMatchedFacilityId());
        ScenicFacilityDetail detail = detailRepository.findByFacilityId(facility.getId()).orElse(null);
        ScenicKnowledgeDocumentRenderer.RenderedDocument rendered = renderer.render(facility, detail);
        PublishTarget target = normalizeTarget(request);
        ScenicKnowledgePublication latest = publicationRepository
                .findFirstByFacilityIdAndAccountIdAndKnowledgeIdOrderByVersionDesc(facility.getId(), target.accountId(), target.knowledgeId())
                .orElse(null);
        if (latest != null && ScenicKnowledgePublication.STATUS_PUBLISHING.equals(latest.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前景点已有发布任务正在进行中");
        }
        if (latest != null
                && rendered.sha256().equals(latest.getContentHash())
                && latest.getDocumentId() != null
                && !latest.getDocumentId().isBlank()
                && (ScenicKnowledgePublication.STATUS_PUBLISHED.equals(latest.getStatus())
                || ScenicKnowledgePublication.STATUS_OUTDATED.equals(latest.getStatus()))) {
            return toDto(latest);
        }

        ScenicKnowledgePublication publication = new ScenicKnowledgePublication();
        publication.setFacilityId(facility.getId());
        publication.setAccountId(target.accountId());
        publication.setKnowledgeId(target.knowledgeId());
        publication.setKnowledgeName(target.knowledgeName());
        publication.setLogicalKey(logicalKey(facility.getId(), target.knowledgeId(), rendered.sha256()));
        publication.setContentHash(rendered.sha256());
        publication.setVersion(latest == null || latest.getVersion() == null ? 1 : latest.getVersion() + 1);
        publication.setStatus(ScenicKnowledgePublication.STATUS_PUBLISHING);
        publication.setPublishedBy(publisherName(actor));
        publication.setPublishedAt(LocalDateTime.now());
        publicationRepository.save(publication);

        try {
            String taskId = extractRequiredTaskId(maxKbKnowledgeService.uploadDocuments(
                    target.accountId(),
                    target.knowledgeId(),
                    List.of(new InMemoryMultipartFile(rendered.fileName(), rendered.markdown())),
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    false,
                    publication.getLogicalKey()));
            TaskSnapshot uploadTask = waitForPreviewReady(target.accountId(), target.knowledgeId(), taskId);
            TaskSnapshot task = uploadTask;
            if (!"COMPLETED".equals(uploadTask.status())) {
                maxKbKnowledgeService.applyUploadTask(target.accountId(), target.knowledgeId(), taskId);
                task = waitForTaskCompletion(target.accountId(), target.knowledgeId(), taskId);
            }
            publication.setDocumentId(task.documentId());
            publication.setLastError(null);
            publication.setPublishedAt(LocalDateTime.now());
            if (latest != null
                    && latest.getDocumentId() != null
                    && !latest.getDocumentId().isBlank()
                    && !latest.getDocumentId().equals(task.documentId())) {
                try {
                    maxKbKnowledgeService.deleteDocument(target.accountId(), target.knowledgeId(), latest.getDocumentId());
                } catch (RuntimeException exception) {
                    publication.setLastError(sanitizeError(exception));
                }
            }
            ScenicKnowledgeDocumentRenderer.RenderedDocument current = renderer.render(
                    findFacility(facility.getId()),
                    detailRepository.findByFacilityId(facility.getId()).orElse(null));
            publication.setStatus(rendered.sha256().equals(current.sha256())
                    ? ScenicKnowledgePublication.STATUS_PUBLISHED
                    : ScenicKnowledgePublication.STATUS_OUTDATED);
            publicationRepository.save(publication);
            return toDto(publication);
        } catch (RuntimeException exception) {
            publication.setStatus(ScenicKnowledgePublication.STATUS_FAILED);
            publication.setLastError(sanitizeError(exception));
            publicationRepository.save(publication);
            throw exception;
        }
    }

    public ScenicKnowledgePublicationDto getStatus(Long facilityId) {
        return publicationRepository.findFirstByFacilityIdOrderByUpdatedAtDescIdDesc(facilityId)
                .map(this::toDto)
                .orElse(null);
    }

    public ScenicKnowledgePublicationDto withdraw(Long facilityId, AuthSession actor) {
        ScenicKnowledgePublication publication = publicationRepository.findFirstByFacilityIdOrderByUpdatedAtDescIdDesc(facilityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "知识发布记录不存在"));
        if (ScenicKnowledgePublication.STATUS_PUBLISHING.equals(publication.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前景点已有发布任务正在进行中");
        }
        if (ScenicKnowledgePublication.STATUS_WITHDRAWN.equals(publication.getStatus())) {
            return toDto(publication);
        }
        if (publication.getDocumentId() == null || publication.getDocumentId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前发布记录没有可撤回的远端文档");
        }
        try {
            maxKbKnowledgeService.deleteDocument(publication.getAccountId(), publication.getKnowledgeId(), publication.getDocumentId());
        } catch (RuntimeException exception) {
            publication.setLastError(sanitizeError(exception));
            publicationRepository.save(publication);
            throw exception;
        }
        publication.setStatus(ScenicKnowledgePublication.STATUS_WITHDRAWN);
        publication.setLastError(null);
        publication.setPublishedBy(publisherName(actor));
        publication.setPublishedAt(LocalDateTime.now());
        publicationRepository.save(publication);
        return toDto(publication);
    }

    public void markOutdated(Long facilityId) {
        Optional<ScenicKnowledgePublication> latest = publicationRepository.findFirstByFacilityIdOrderByUpdatedAtDescIdDesc(facilityId);
        if (latest.isEmpty()) {
            return;
        }
        ScenicKnowledgePublication publication = latest.get();
        if (!ScenicKnowledgePublication.STATUS_PUBLISHED.equals(publication.getStatus())) {
            return;
        }
        publication.setStatus(ScenicKnowledgePublication.STATUS_OUTDATED);
        publicationRepository.save(publication);
    }

    private ScenicStructuredSpotRecord requireAppliedRecord(Long recordId) {
        ScenicStructuredSpotRecord record = recordRepository.findById(recordId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "导入记录不存在"));
        if (!"applied".equalsIgnoreCase(normalize(record.getApplyStatus())) || record.getMatchedFacilityId() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "请先应用到正式景点");
        }
        return record;
    }

    private ScenicFacility findFacility(Long facilityId) {
        return facilityRepository.findByIdAndDeletedAtIsNull(facilityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "正式景点不存在"));
    }

    private PublishTarget normalizeTarget(ScenicKnowledgePublishRequest request) {
        if (request == null || request.getAccountId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "账号不能为空");
        }
        String knowledgeId = normalize(request.getKnowledgeId());
        if (knowledgeId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "知识库 ID 不能为空");
        }
        return new PublishTarget(request.getAccountId(), knowledgeId, normalize(request.getKnowledgeName()));
    }

    private String extractRequiredTaskId(Object source) {
        String taskId = text(source, "task_id", "taskId", "id");
        if (taskId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MaxKB 未返回上传任务 ID");
        }
        return taskId;
    }

    private TaskSnapshot waitForPreviewReady(Long accountId, String knowledgeId, String taskId) {
        for (int attempt = 0; attempt < MAX_UPLOAD_TASK_POLLS; attempt++) {
            Object payload = maxKbKnowledgeService.getUploadTask(accountId, knowledgeId, taskId);
            String normalizedStatus = normalizeStatus(payload);
            if ("PREVIEW_READY".equals(normalizedStatus) || "COMPLETED".equals(normalizedStatus)) {
                return new TaskSnapshot(normalizedStatus, text(payload, "document_id", "documentId"));
            }
            if (isFailedStatus(normalizedStatus)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        sanitizeError(text(payload, "message", "error", "detail", "reason")));
            }
        }
        throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "等待 MaxKB 上传任务进入可应用状态超时");
    }

    private TaskSnapshot waitForTaskCompletion(Long accountId, String knowledgeId, String taskId) {
        for (int attempt = 0; attempt < MAX_UPLOAD_TASK_POLLS; attempt++) {
            Object payload = maxKbKnowledgeService.getUploadTask(accountId, knowledgeId, taskId);
            String normalizedStatus = normalizeStatus(payload);
            if (List.of("COMPLETED", "SUCCESS", "SUCCEEDED", "DONE").contains(normalizedStatus)) {
                String documentId = text(payload, "document_id", "documentId");
                if (documentId == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MaxKB 上传任务完成但缺少文档 ID");
                }
                return new TaskSnapshot(normalizedStatus, documentId);
            }
            if (isFailedStatus(normalizedStatus)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        sanitizeError(text(payload, "message", "error", "detail", "reason")));
            }
        }
        throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "等待 MaxKB 上传任务完成超时");
    }

    private String normalizeStatus(Object payload) {
        String status = normalize(text(payload, "status", "task_status", "state"));
        if (status == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MaxKB 上传任务缺少状态");
        }
        return status.toUpperCase();
    }

    private boolean isFailedStatus(String status) {
        return List.of("FAILED", "ERROR", "CANCELLED", "CANCELED").contains(status);
    }

    private ScenicKnowledgePublicationDto toDto(ScenicKnowledgePublication publication) {
        ScenicKnowledgePublicationDto dto = new ScenicKnowledgePublicationDto();
        dto.setId(publication.getId());
        dto.setFacilityId(publication.getFacilityId());
        dto.setAccountId(publication.getAccountId());
        dto.setKnowledgeId(publication.getKnowledgeId());
        dto.setKnowledgeName(publication.getKnowledgeName());
        dto.setDocumentId(publication.getDocumentId());
        dto.setLogicalKey(publication.getLogicalKey());
        dto.setContentHash(publication.getContentHash());
        dto.setVersion(publication.getVersion());
        dto.setStatus(publication.getStatus());
        dto.setLastError(publication.getLastError());
        dto.setPublishedBy(publication.getPublishedBy());
        dto.setPublishedAt(publication.getPublishedAt());
        dto.setCreatedAt(publication.getCreatedAt());
        dto.setUpdatedAt(publication.getUpdatedAt());
        return dto;
    }

    private String sanitizeError(RuntimeException exception) {
        if (exception instanceof ResponseStatusException responseStatusException) {
            return sanitizeError(responseStatusException.getReason());
        }
        return sanitizeError(exception.getMessage());
    }

    private String sanitizeError(String message) {
        String value = normalize(message);
        if (value == null) {
            return "未知错误";
        }
        String sanitized = AUTHORIZATION_PATTERN.matcher(value).replaceAll("Authorization: Bearer ***");
        sanitized = BEARER_PATTERN.matcher(sanitized).replaceAll("Bearer ***");
        sanitized = TOKEN_PATTERN.matcher(sanitized).replaceAll("token=***");
        sanitized = API_KEY_PATTERN.matcher(sanitized).replaceAll("api_key=***");
        return sanitized.length() > 2000 ? sanitized.substring(0, 2000) : sanitized;
    }

    private String text(Object source, String... keys) {
        if (source == null) {
            return null;
        }
        if (source instanceof Map<?, ?> map) {
            for (String key : keys) {
                Object value = map.get(key);
                if (value instanceof String stringValue && !stringValue.isBlank()) {
                    return stringValue.trim();
                }
                if (value != null && !(value instanceof Map)) {
                    String text = normalize(String.valueOf(value));
                    if (text != null) {
                        return text;
                    }
                }
            }
            for (Object nested : map.values()) {
                String value = text(nested, keys);
                if (value != null) {
                    return value;
                }
            }
            return null;
        }
        try {
            Map<String, Object> converted = objectMapper.convertValue(source, new TypeReference<Map<String, Object>>() {});
            return text(converted, keys);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private String logicalKey(Long facilityId, String knowledgeId, String sha256) {
        return "scenic:" + facilityId + ":" + knowledgeId + ":" + sha256;
    }

    private String publisherName(AuthSession actor) {
        if (actor == null) {
            return null;
        }
        return normalize(actor.getDisplayName()) != null ? actor.getDisplayName() : actor.getUsername();
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private record PublishTarget(Long accountId, String knowledgeId, String knowledgeName) {
    }

    private record TaskSnapshot(String status, String documentId) {
    }

    private static final class InMemoryMultipartFile implements MultipartFile {

        private final String fileName;
        private final byte[] bytes;

        private InMemoryMultipartFile(String fileName, String content) {
            this.fileName = fileName;
            this.bytes = content.getBytes(StandardCharsets.UTF_8);
        }

        @Override
        public String getName() {
            return "file";
        }

        @Override
        public String getOriginalFilename() {
            return fileName;
        }

        @Override
        public String getContentType() {
            return "text/markdown";
        }

        @Override
        public boolean isEmpty() {
            return bytes.length == 0;
        }

        @Override
        public long getSize() {
            return bytes.length;
        }

        @Override
        public byte[] getBytes() {
            return bytes.clone();
        }

        @Override
        public InputStream getInputStream() {
            return new ByteArrayInputStream(bytes);
        }

        @Override
        public void transferTo(java.io.File dest) throws IOException, IllegalStateException {
            throw new UnsupportedOperationException("Not needed for in-memory upload");
        }
    }
}
