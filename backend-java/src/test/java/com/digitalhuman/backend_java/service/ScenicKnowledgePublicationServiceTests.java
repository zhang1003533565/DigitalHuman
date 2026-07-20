package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicKnowledgePublicationDto;
import com.digitalhuman.backend_java.dto.ScenicKnowledgePublishRequest;
import com.digitalhuman.backend_java.dto.ScenicKnowledgePreviewDto;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.FacilityCategory;
import com.digitalhuman.backend_java.model.ScenicFacility;
import com.digitalhuman.backend_java.model.ScenicFacilityDetail;
import com.digitalhuman.backend_java.model.ScenicKnowledgePublication;
import com.digitalhuman.backend_java.model.ScenicStructuredSpotRecord;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.repository.ScenicFacilityDetailRepository;
import com.digitalhuman.backend_java.repository.ScenicFacilityRepository;
import com.digitalhuman.backend_java.repository.ScenicKnowledgePublicationRepository;
import com.digitalhuman.backend_java.repository.ScenicStructuredSpotRecordRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ScenicKnowledgePublicationServiceTests {

    @Test
    void previewRejectsRecordThatHasNotBeenAppliedToOfficialFacility() {
        Fixtures fixtures = fixtures();
        fixtures.record.setApplyStatus("pending");
        fixtures.record.setMatchedFacilityId(null);

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> fixtures.service.preview(8L));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertEquals("请先应用到正式景点", error.getReason());
        verify(fixtures.maxKbKnowledgeService, never()).uploadDocuments(
                any(), any(), anyList(), anyList(), anyInt(), anyList(), anyBoolean(), anyString(),
                anyString(), anyString(), anyString(), anyBoolean(), anyBoolean(), anyString());
    }

    @Test
    void previewRendersOnlyOfficialMatchedFacilityData() {
        Fixtures fixtures = fixtures();

        ScenicKnowledgePreviewDto preview = fixtures.service.preview(8L);

        assertEquals(8L, preview.getRecordId());
        assertEquals(12L, preview.getFacilityId());
        assertEquals("scenic-facility-12.md", preview.getFileName());
        assertEquals(fixtures.renderer.render(fixtures.facility, fixtures.detail).sha256(), preview.getSha256());
        assertTrue(preview.getMarkdown().contains("正式景点简介"));
        assertTrue(preview.getMarkdown().contains("正式核心功能"));
        assertFalse(preview.getMarkdown().contains("导入暂存简介"));
        assertFalse(preview.getMarkdown().contains("导入核心功能"));
    }

    @Test
    void publishReturnsExistingPublicationWhenCurrentOfficialShaAlreadyPublishedToTheTarget() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgeDocumentRenderer.RenderedDocument rendered = fixtures.renderer.render(fixtures.facility, fixtures.detail);
        ScenicKnowledgePublication active = publication(12L, 3L, "kb-1", "灵山知识库", "doc-1", rendered.sha256(), 4, ScenicKnowledgePublication.STATUS_PUBLISHED);
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(active));

        ScenicKnowledgePublicationDto result = fixtures.service.publish(8L, publishRequest(), admin());

        assertEquals(active.getDocumentId(), result.getDocumentId());
        assertEquals(active.getVersion(), result.getVersion());
        assertEquals(ScenicKnowledgePublication.STATUS_PUBLISHED, result.getStatus());
        verify(fixtures.maxKbKnowledgeService, never()).uploadDocuments(
                any(), any(), anyList(), anyList(), anyInt(), anyList(), anyBoolean(), anyString(),
                anyString(), anyString(), anyString(), anyBoolean(), anyBoolean(), anyString());
    }

    @Test
    void publishUploadsAppliesAndDeletesOldDocumentOnlyAfterTheNewTaskCompletes() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgePublication active = publication(12L, 3L, "kb-1", "灵山知识库", "doc-old", "old-hash", 2, ScenicKnowledgePublication.STATUS_PUBLISHED);
        when(fixtures.publicationRepository.findFirstByFacilityIdAndAccountIdAndKnowledgeIdOrderByVersionDesc(12L, 3L, "kb-1"))
                .thenReturn(Optional.of(active));
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(active));
        when(fixtures.maxKbKnowledgeService.uploadDocuments(
                eq(3L), eq("kb-1"), anyList(), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(null), eq(null), eq(null), eq(null), eq(false), anyString()))
                .thenReturn(Map.of("task_id", "task-1"));
        when(fixtures.maxKbKnowledgeService.applyUploadTask(3L, "kb-1", "task-1")).thenReturn(Map.of("status", "accepted"));
        when(fixtures.maxKbKnowledgeService.getUploadTask(3L, "kb-1", "task-1"))
                .thenReturn(Map.of("status", "PREVIEW_READY"))
                .thenReturn(Map.of("status", "COMPLETED", "document_id", "doc-new"));

        ScenicKnowledgePublicationDto result = fixtures.service.publish(8L, publishRequest(), admin());

        assertEquals("doc-new", result.getDocumentId());
        assertEquals(3, result.getVersion());
        assertEquals(ScenicKnowledgePublication.STATUS_PUBLISHED, result.getStatus());
        InOrder inOrder = inOrder(fixtures.maxKbKnowledgeService);
        inOrder.verify(fixtures.maxKbKnowledgeService).uploadDocuments(
                eq(3L), eq("kb-1"), anyList(), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(null), eq(null), eq(null), eq(null), eq(false), eq("scenic:12:kb-1:" + result.getContentHash()));
        inOrder.verify(fixtures.maxKbKnowledgeService).getUploadTask(3L, "kb-1", "task-1");
        inOrder.verify(fixtures.maxKbKnowledgeService).applyUploadTask(3L, "kb-1", "task-1");
        inOrder.verify(fixtures.maxKbKnowledgeService).getUploadTask(3L, "kb-1", "task-1");
        InOrder localThenRemote = inOrder(fixtures.publicationRepository, fixtures.maxKbKnowledgeService);
        localThenRemote.verify(fixtures.publicationRepository).save(argThat(saved ->
                "doc-new".equals(saved.getDocumentId())
                        && ScenicKnowledgePublication.STATUS_PUBLISHED.equals(saved.getStatus())
                        && saved.getPublishSlot() == null));
        localThenRemote.verify(fixtures.publicationRepository).save(argThat(saved ->
                "doc-old".equals(saved.getDocumentId())
                        && ScenicKnowledgePublication.STATUS_WITHDRAWN.equals(saved.getStatus())
                        && saved.getPublishSlot() == null));
        localThenRemote.verify(fixtures.maxKbKnowledgeService).deleteDocument(3L, "kb-1", "doc-old");
        assertEquals(ScenicKnowledgePublication.STATUS_WITHDRAWN, active.getStatus());
        ArgumentCaptor<List> filesCaptor = ArgumentCaptor.forClass(List.class);
        verify(fixtures.maxKbKnowledgeService).uploadDocuments(
                eq(3L), eq("kb-1"), filesCaptor.capture(), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(null), eq(null), eq(null), eq(null), eq(false), anyString());
        MultipartFile uploadedFile = (MultipartFile) filesCaptor.getValue().get(0);
        assertEquals("scenic-facility-12.md", uploadedFile.getOriginalFilename());
        assertTrue(new String(readAll(uploadedFile), StandardCharsets.UTF_8).contains("正式景点简介"));
    }

    @Test
    void publishToNewTargetReplacesTheFacilitysPreviousRemoteDocument() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgePublication active = publication(
                12L,
                4L,
                "kb-old",
                "旧知识库",
                "doc-old",
                fixtures.renderer.render(fixtures.facility, fixtures.detail).sha256(),
                2,
                ScenicKnowledgePublication.STATUS_PUBLISHED);
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(active));
        when(fixtures.maxKbKnowledgeService.uploadDocuments(
                eq(3L), eq("kb-1"), anyList(), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(null), eq(null), eq(null), eq(null), eq(false), anyString()))
                .thenReturn(Map.of("task_id", "task-1"));
        when(fixtures.maxKbKnowledgeService.applyUploadTask(3L, "kb-1", "task-1")).thenReturn(Map.of("status", "accepted"));
        when(fixtures.maxKbKnowledgeService.getUploadTask(3L, "kb-1", "task-1"))
                .thenReturn(Map.of("status", "PREVIEW_READY"))
                .thenReturn(Map.of("status", "COMPLETED", "document_id", "doc-new"));

        ScenicKnowledgePublicationDto result = fixtures.service.publish(8L, publishRequest(), admin());

        assertEquals("doc-new", result.getDocumentId());
        assertEquals(ScenicKnowledgePublication.STATUS_WITHDRAWN, active.getStatus());
        verify(fixtures.maxKbKnowledgeService).deleteDocument(4L, "kb-old", "doc-old");
    }

    @Test
    void publishFailureSanitizesErrorAndPreservesExistingPublishedRecord() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgePublication latest = publication(12L, 3L, "kb-1", "灵山知识库", "doc-old", "old-hash", 2, ScenicKnowledgePublication.STATUS_PUBLISHED);
        when(fixtures.publicationRepository.findFirstByFacilityIdAndAccountIdAndKnowledgeIdOrderByVersionDesc(12L, 3L, "kb-1"))
                .thenReturn(Optional.of(latest));
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(latest));
        when(fixtures.maxKbKnowledgeService.uploadDocuments(
                eq(3L), eq("kb-1"), anyList(), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(null), eq(null), eq(null), eq(null), eq(false), anyString()))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "token=abc Authorization: Bearer secret https://host.example?api_key=123 上传失败"));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> fixtures.service.publish(8L, publishRequest(), admin()));

        assertEquals(HttpStatus.BAD_GATEWAY, error.getStatusCode());
        verify(fixtures.maxKbKnowledgeService, never()).deleteDocument(any(), any(), any());
        ScenicKnowledgePublication failed = fixtures.savedPublications.get(fixtures.savedPublications.size() - 1);
        assertEquals(ScenicKnowledgePublication.STATUS_FAILED, failed.getStatus());
        assertNotNull(failed.getLastError());
        assertFalse(failed.getLastError().contains("Bearer secret"));
        assertFalse(failed.getLastError().contains("api_key=123"));
        assertFalse(failed.getLastError().contains("token=abc"));
        assertEquals(null, failed.getPublishSlot());
        assertEquals(ScenicKnowledgePublication.STATUS_PUBLISHED, latest.getStatus());
    }

    @Test
    void publishReturnsConflictWhenDbReservationDetectsConcurrentPublishingAttempt() {
        Fixtures fixtures = fixtures();
        when(fixtures.publicationRepository.saveAndFlush(any(ScenicKnowledgePublication.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate publish slot"));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> fixtures.service.publish(8L, publishRequest(), admin()));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertEquals("当前景点已有发布任务正在进行中", error.getReason());
        verify(fixtures.maxKbKnowledgeService, never()).uploadDocuments(
                any(), any(), anyList(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), anyBoolean(), anyString());
    }

    @Test
    void publishRollsBackNewDocumentAndPreservesActivePublicationWhenReplacingOldDocumentFails() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgePublication active = publication(12L, 3L, "kb-1", "灵山知识库", "doc-old", "old-hash", 2, ScenicKnowledgePublication.STATUS_PUBLISHED);
        when(fixtures.publicationRepository.findFirstByFacilityIdAndAccountIdAndKnowledgeIdOrderByVersionDesc(12L, 3L, "kb-1"))
                .thenReturn(Optional.of(active));
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(active));
        when(fixtures.maxKbKnowledgeService.uploadDocuments(
                eq(3L), eq("kb-1"), anyList(), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(null), eq(null), eq(null), eq(null), eq(false), anyString()))
                .thenReturn(Map.of("task_id", "task-1"));
        when(fixtures.maxKbKnowledgeService.applyUploadTask(3L, "kb-1", "task-1")).thenReturn(Map.of("status", "accepted"));
        when(fixtures.maxKbKnowledgeService.getUploadTask(3L, "kb-1", "task-1"))
                .thenReturn(Map.of("status", "PREVIEW_READY"))
                .thenReturn(Map.of("status", "COMPLETED", "document_id", "doc-new"));
        when(fixtures.maxKbKnowledgeService.deleteDocument(3L, "kb-1", "doc-old"))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Bearer secret 删除旧文档失败"));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> fixtures.service.publish(8L, publishRequest(), admin()));

        assertEquals(HttpStatus.BAD_GATEWAY, error.getStatusCode());
        assertFalse(error.getReason().contains("Bearer secret"));
        assertTrue(fixtures.savedPublications.stream().anyMatch(saved ->
                "doc-old".equals(saved.getDocumentId())
                        && ScenicKnowledgePublication.STATUS_PUBLISHED.equals(saved.getStatus())));
        assertTrue(fixtures.savedPublications.stream().anyMatch(saved ->
                "doc-new".equals(saved.getDocumentId())
                        && ScenicKnowledgePublication.STATUS_FAILED.equals(saved.getStatus())
                        && saved.getPublishSlot() == null));
        verify(fixtures.maxKbKnowledgeService).deleteDocument(3L, "kb-1", "doc-new");
        assertEquals(ScenicKnowledgePublication.STATUS_PUBLISHED, active.getStatus());
        ScenicKnowledgePublication failed = fixtures.savedPublications.get(fixtures.savedPublications.size() - 1);
        assertEquals(ScenicKnowledgePublication.STATUS_FAILED, failed.getStatus());
        assertEquals(null, failed.getDocumentId());
    }

    @Test
    void publishRestoresOriginalOutdatedStatusWhenCompensationSucceeds() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgePublication active = publication(12L, 3L, "kb-1", "灵山知识库", "doc-old", "old-hash", 2, ScenicKnowledgePublication.STATUS_OUTDATED);
        fixtures.detail.setRemark("保持原内容");
        when(fixtures.publicationRepository.findFirstByFacilityIdAndAccountIdAndKnowledgeIdOrderByVersionDesc(12L, 3L, "kb-1"))
                .thenReturn(Optional.of(active));
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(active));
        when(fixtures.maxKbKnowledgeService.uploadDocuments(
                eq(3L), eq("kb-1"), anyList(), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(null), eq(null), eq(null), eq(null), eq(false), anyString()))
                .thenReturn(Map.of("task_id", "task-1"));
        when(fixtures.maxKbKnowledgeService.applyUploadTask(3L, "kb-1", "task-1")).thenReturn(Map.of("status", "accepted"));
        when(fixtures.maxKbKnowledgeService.getUploadTask(3L, "kb-1", "task-1"))
                .thenReturn(Map.of("status", "PREVIEW_READY"))
                .thenReturn(Map.of("status", "COMPLETED", "document_id", "doc-new"));
        when(fixtures.maxKbKnowledgeService.deleteDocument(3L, "kb-1", "doc-old"))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Bearer secret 删除旧文档失败"));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> fixtures.service.publish(8L, publishRequest(), admin()));

        assertEquals(HttpStatus.BAD_GATEWAY, error.getStatusCode());
        assertTrue(fixtures.savedPublications.stream().anyMatch(saved ->
                "doc-old".equals(saved.getDocumentId())
                        && ScenicKnowledgePublication.STATUS_OUTDATED.equals(saved.getStatus())));
    }

    @Test
    void publishKeepsNewActiveWhenDeletingOldAndNewRemoteBothFail() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgePublication active = publication(12L, 3L, "kb-1", "灵山知识库", "doc-old", "old-hash", 2, ScenicKnowledgePublication.STATUS_PUBLISHED);
        when(fixtures.publicationRepository.findFirstByFacilityIdAndAccountIdAndKnowledgeIdOrderByVersionDesc(12L, 3L, "kb-1"))
                .thenReturn(Optional.of(active));
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(active));
        when(fixtures.maxKbKnowledgeService.uploadDocuments(
                eq(3L), eq("kb-1"), anyList(), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(null), eq(null), eq(null), eq(null), eq(false), anyString()))
                .thenReturn(Map.of("task_id", "task-1"));
        when(fixtures.maxKbKnowledgeService.applyUploadTask(3L, "kb-1", "task-1")).thenReturn(Map.of("status", "accepted"));
        when(fixtures.maxKbKnowledgeService.getUploadTask(3L, "kb-1", "task-1"))
                .thenReturn(Map.of("status", "PREVIEW_READY"))
                .thenReturn(Map.of("status", "COMPLETED", "document_id", "doc-new"));
        when(fixtures.maxKbKnowledgeService.deleteDocument(3L, "kb-1", "doc-old"))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Bearer secret 删除旧文档失败"));
        when(fixtures.maxKbKnowledgeService.deleteDocument(3L, "kb-1", "doc-new"))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "token=abc 回滚新文档失败"));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> fixtures.service.publish(8L, publishRequest(), admin()));

        assertEquals(HttpStatus.BAD_GATEWAY, error.getStatusCode());
        assertFalse(error.getReason().contains("Bearer secret"));
        assertFalse(error.getReason().contains("token=abc"));
        assertEquals(ScenicKnowledgePublication.STATUS_PUBLISHED, active.getStatus());
        ScenicKnowledgePublication latestSaved = fixtures.savedPublications.get(fixtures.savedPublications.size() - 1);
        assertEquals(ScenicKnowledgePublication.STATUS_FAILED, latestSaved.getStatus());
        assertEquals("doc-new", latestSaved.getDocumentId());
        assertNotNull(latestSaved.getLastError());
    }

    @Test
    void publishLeavesCommittedNewActiveWhenCompensationTransactionFails() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgePublication active = publication(12L, 3L, "kb-1", "灵山知识库", "doc-old", "old-hash", 2, ScenicKnowledgePublication.STATUS_PUBLISHED);
        AtomicBoolean failCompensationSave = new AtomicBoolean(true);
        when(fixtures.publicationRepository.findFirstByFacilityIdAndAccountIdAndKnowledgeIdOrderByVersionDesc(12L, 3L, "kb-1"))
                .thenReturn(Optional.of(active));
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(active));
        when(fixtures.publicationRepository.save(any(ScenicKnowledgePublication.class))).thenAnswer(invocation -> {
            ScenicKnowledgePublication publication = invocation.getArgument(0);
            if (failCompensationSave.get()
                    && "doc-old".equals(publication.getDocumentId())
                    && ScenicKnowledgePublication.STATUS_PUBLISHED.equals(publication.getStatus())) {
                failCompensationSave.set(false);
                throw new IllegalStateException("compensation transaction failed");
            }
            return fixtures.capture(publication);
        });
        when(fixtures.maxKbKnowledgeService.uploadDocuments(
                eq(3L), eq("kb-1"), anyList(), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(null), eq(null), eq(null), eq(null), eq(false), anyString()))
                .thenReturn(Map.of("task_id", "task-1"));
        when(fixtures.maxKbKnowledgeService.applyUploadTask(3L, "kb-1", "task-1")).thenReturn(Map.of("status", "accepted"));
        when(fixtures.maxKbKnowledgeService.getUploadTask(3L, "kb-1", "task-1"))
                .thenReturn(Map.of("status", "PREVIEW_READY"))
                .thenReturn(Map.of("status", "COMPLETED", "document_id", "doc-new"));
        when(fixtures.maxKbKnowledgeService.deleteDocument(3L, "kb-1", "doc-old"))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Bearer secret 删除旧文档失败"));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> fixtures.service.publish(8L, publishRequest(), admin()));

        assertEquals(HttpStatus.BAD_GATEWAY, error.getStatusCode());
        assertFalse(error.getReason().contains("Bearer secret"));
        verify(fixtures.maxKbKnowledgeService, never()).deleteDocument(3L, "kb-1", "doc-new");
        long activeRows = fixtures.latestSavedPublications().stream()
                .filter(saved -> List.of(
                                ScenicKnowledgePublication.STATUS_PUBLISHED,
                                ScenicKnowledgePublication.STATUS_OUTDATED)
                        .contains(saved.getStatus()))
                .count();
        assertEquals(1L, activeRows);
        ScenicKnowledgePublication latestSaved = fixtures.savedPublications.get(fixtures.savedPublications.size() - 1);
        assertEquals(ScenicKnowledgePublication.STATUS_WITHDRAWN, latestSaved.getStatus());
    }

    @Test
    void publishDeletesNewRemoteAndMarksAttemptFailedWhenLocalHandoffPersistFails() {
        Fixtures fixtures = fixtures();
        AtomicBoolean failPublishedSave = new AtomicBoolean(true);
        when(fixtures.publicationRepository.save(any(ScenicKnowledgePublication.class))).thenAnswer(invocation -> {
            ScenicKnowledgePublication publication = invocation.getArgument(0);
            if (failPublishedSave.get()
                    && "doc-new".equals(publication.getDocumentId())
                    && ScenicKnowledgePublication.STATUS_PUBLISHED.equals(publication.getStatus())) {
                failPublishedSave.set(false);
                throw new IllegalStateException("local handoff failed");
            }
            return fixtures.capture(publication);
        });
        when(fixtures.maxKbKnowledgeService.uploadDocuments(
                eq(3L), eq("kb-1"), anyList(), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(null), eq(null), eq(null), eq(null), eq(false), anyString()))
                .thenReturn(Map.of("task_id", "task-1"));
        when(fixtures.maxKbKnowledgeService.applyUploadTask(3L, "kb-1", "task-1")).thenReturn(Map.of("status", "accepted"));
        when(fixtures.maxKbKnowledgeService.getUploadTask(3L, "kb-1", "task-1"))
                .thenReturn(Map.of("status", "PREVIEW_READY"))
                .thenReturn(Map.of("status", "COMPLETED", "document_id", "doc-new"));

        IllegalStateException error = assertThrows(
                IllegalStateException.class,
                () -> fixtures.service.publish(8L, publishRequest(), admin()));

        assertEquals("local handoff failed", error.getMessage());
        verify(fixtures.maxKbKnowledgeService).deleteDocument(3L, "kb-1", "doc-new");
        ScenicKnowledgePublication latestSaved = fixtures.savedPublications.get(fixtures.savedPublications.size() - 1);
        assertEquals(ScenicKnowledgePublication.STATUS_FAILED, latestSaved.getStatus());
        assertEquals(null, latestSaved.getDocumentId());
    }

    @Test
    void publishFailsWhenPreviewPollCompletesWithoutDocumentId() {
        Fixtures fixtures = fixtures();
        when(fixtures.maxKbKnowledgeService.uploadDocuments(
                eq(3L), eq("kb-1"), anyList(), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(null), eq(null), eq(null), eq(null), eq(false), anyString()))
                .thenReturn(Map.of("task_id", "task-1"));
        when(fixtures.maxKbKnowledgeService.getUploadTask(3L, "kb-1", "task-1"))
                .thenReturn(Map.of("status", "COMPLETED"));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> fixtures.service.publish(8L, publishRequest(), admin()));

        assertEquals(HttpStatus.BAD_GATEWAY, error.getStatusCode());
        assertEquals("MaxKB 上传任务完成但缺少文档 ID", error.getReason());
        ScenicKnowledgePublication latestSaved = fixtures.savedPublications.get(fixtures.savedPublications.size() - 1);
        assertEquals(ScenicKnowledgePublication.STATUS_FAILED, latestSaved.getStatus());
        assertEquals(null, latestSaved.getDocumentId());
        assertFalse(fixtures.savedPublications.stream()
                .anyMatch(saved -> ScenicKnowledgePublication.STATUS_PUBLISHED.equals(saved.getStatus())));
    }

    @Test
    void publishMarksResultOutdatedWhenOfficialContentChangesBeforeSwitch() {
        Fixtures fixtures = fixtures();
        when(fixtures.maxKbKnowledgeService.uploadDocuments(
                eq(3L), eq("kb-1"), anyList(), eq(null), eq(null), eq(null), eq(null), eq(null),
                eq(null), eq(null), eq(null), eq(null), eq(false), anyString()))
                .thenReturn(Map.of("taskId", "task-1"));
        when(fixtures.maxKbKnowledgeService.applyUploadTask(3L, "kb-1", "task-1")).thenReturn(Map.of("status", "accepted"));
        when(fixtures.maxKbKnowledgeService.getUploadTask(3L, "kb-1", "task-1"))
                .thenAnswer(invocation -> {
                    if (!"发布期间已修改".equals(fixtures.detail.getRemark())) {
                        fixtures.detail.setRemark("发布期间已修改");
                        return Map.of("status", "PREVIEW_READY");
                    }
                    return Map.of("status", "COMPLETED", "documentId", "doc-new");
                });

        ScenicKnowledgePublicationDto result = fixtures.service.publish(8L, publishRequest(), admin());

        assertEquals(ScenicKnowledgePublication.STATUS_OUTDATED, result.getStatus());
        assertEquals("doc-new", result.getDocumentId());
    }

    @Test
    void withdrawDeletesRemoteDocumentBeforeMarkingPublicationWithdrawn() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgePublication latest = publication(12L, 3L, "kb-1", "灵山知识库", "doc-1", "hash-1", 2, ScenicKnowledgePublication.STATUS_PUBLISHED);
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(latest));

        ScenicKnowledgePublicationDto result = fixtures.service.withdraw(12L, admin());

        assertEquals(ScenicKnowledgePublication.STATUS_WITHDRAWN, result.getStatus());
        assertEquals("旧管理员", result.getPublishedBy());
        assertEquals(latest.getPublishedAt(), result.getPublishedAt());
        InOrder inOrder = inOrder(fixtures.maxKbKnowledgeService, fixtures.publicationRepository);
        inOrder.verify(fixtures.maxKbKnowledgeService).deleteDocument(3L, "kb-1", "doc-1");
        inOrder.verify(fixtures.publicationRepository).save(latest);
    }

    @Test
    void markOutdatedOnlyTouchesLatestPublishedPublication() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgePublication latest = publication(12L, 3L, "kb-1", "灵山知识库", "doc-1", "hash-1", 2, ScenicKnowledgePublication.STATUS_PUBLISHED);
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(latest));

        fixtures.service.markOutdated(12L);

        assertEquals(ScenicKnowledgePublication.STATUS_OUTDATED, latest.getStatus());
        verify(fixtures.publicationRepository).save(latest);
    }

    @Test
    void getStatusPrefersCurrentActivePublicationWhenNewerRepublishAttemptFailed() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgePublication active = publication(12L, 3L, "kb-1", "灵山知识库", "doc-live", "hash-live", 2, ScenicKnowledgePublication.STATUS_PUBLISHED);
        ScenicKnowledgePublication failed = publication(12L, 3L, "kb-1", "灵山知识库", null, "hash-failed", 3, ScenicKnowledgePublication.STATUS_FAILED);
        failed.setUpdatedAt(LocalDateTime.now());
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(active));
        when(fixtures.publicationRepository.findFirstByFacilityIdOrderByUpdatedAtDescIdDesc(12L))
                .thenReturn(Optional.of(failed));

        ScenicKnowledgePublicationDto status = fixtures.service.getStatus(12L);

        assertEquals("doc-live", status.getDocumentId());
        assertEquals(ScenicKnowledgePublication.STATUS_PUBLISHED, status.getStatus());
    }

    @Test
    void withdrawUsesCurrentActivePublicationWhenNewerRepublishAttemptFailed() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgePublication active = publication(12L, 3L, "kb-1", "灵山知识库", "doc-live", "hash-live", 2, ScenicKnowledgePublication.STATUS_PUBLISHED);
        ScenicKnowledgePublication failed = publication(12L, 3L, "kb-1", "灵山知识库", null, "hash-failed", 3, ScenicKnowledgePublication.STATUS_FAILED);
        failed.setUpdatedAt(LocalDateTime.now());
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(active));
        when(fixtures.publicationRepository.findFirstByFacilityIdOrderByUpdatedAtDescIdDesc(12L))
                .thenReturn(Optional.of(failed));

        ScenicKnowledgePublicationDto result = fixtures.service.withdraw(12L, admin());

        assertEquals("doc-live", result.getDocumentId());
        verify(fixtures.maxKbKnowledgeService).deleteDocument(3L, "kb-1", "doc-live");
        assertEquals(ScenicKnowledgePublication.STATUS_FAILED, failed.getStatus());
    }

    @Test
    void markOutdatedUsesCurrentActivePublicationWhenNewerRepublishAttemptFailed() {
        Fixtures fixtures = fixtures();
        ScenicKnowledgePublication active = publication(12L, 3L, "kb-1", "灵山知识库", "doc-live", "hash-live", 2, ScenicKnowledgePublication.STATUS_PUBLISHED);
        ScenicKnowledgePublication failed = publication(12L, 3L, "kb-1", "灵山知识库", null, "hash-failed", 3, ScenicKnowledgePublication.STATUS_FAILED);
        failed.setUpdatedAt(LocalDateTime.now());
        when(fixtures.publicationRepository.findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
                12L, List.of(ScenicKnowledgePublication.STATUS_PUBLISHED, ScenicKnowledgePublication.STATUS_OUTDATED), ""))
                .thenReturn(Optional.of(active));
        when(fixtures.publicationRepository.findFirstByFacilityIdOrderByUpdatedAtDescIdDesc(12L))
                .thenReturn(Optional.of(failed));

        fixtures.service.markOutdated(12L);

        assertEquals(ScenicKnowledgePublication.STATUS_OUTDATED, active.getStatus());
        assertEquals(ScenicKnowledgePublication.STATUS_FAILED, failed.getStatus());
    }

    private Fixtures fixtures() {
        ScenicStructuredSpotRecordRepository recordRepository = mock(ScenicStructuredSpotRecordRepository.class);
        ScenicFacilityRepository facilityRepository = mock(ScenicFacilityRepository.class);
        ScenicFacilityDetailRepository detailRepository = mock(ScenicFacilityDetailRepository.class);
        ScenicKnowledgePublicationRepository publicationRepository = mock(ScenicKnowledgePublicationRepository.class);
        MaxKbKnowledgeService maxKbKnowledgeService = mock(MaxKbKnowledgeService.class);
        ScenicKnowledgeDocumentRenderer renderer = new ScenicKnowledgeDocumentRenderer();
        ScenicStructuredSpotRecord record = record();
        ScenicFacility facility = facility();
        ScenicFacilityDetail detail = detail();
        when(recordRepository.findById(8L)).thenReturn(Optional.of(record));
        when(facilityRepository.findByIdAndDeletedAtIsNull(12L)).thenReturn(Optional.of(facility));
        when(detailRepository.findByFacilityId(12L)).thenReturn(Optional.of(detail));
        List<ScenicKnowledgePublication> savedPublications = new ArrayList<>();
        when(publicationRepository.save(any(ScenicKnowledgePublication.class))).thenAnswer(invocation -> {
            ScenicKnowledgePublication publication = invocation.getArgument(0);
            return capture(savedPublications, publication);
        });
        when(publicationRepository.saveAndFlush(any(ScenicKnowledgePublication.class))).thenAnswer(invocation -> {
            ScenicKnowledgePublication publication = invocation.getArgument(0);
            return capture(savedPublications, publication);
        });
        ScenicKnowledgePublicationStateService publicationStateService = new ScenicKnowledgePublicationStateService(publicationRepository);
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        ScenicKnowledgePublicationService service = new ScenicKnowledgePublicationService(
                recordRepository,
                facilityRepository,
                detailRepository,
                publicationRepository,
                renderer,
                maxKbKnowledgeService,
                publicationStateService,
                transactionManager,
                new ObjectMapper());
        return new Fixtures(service, renderer, maxKbKnowledgeService, publicationRepository, record, facility, detail, savedPublications);
    }

    private ScenicKnowledgePublication capture(List<ScenicKnowledgePublication> savedPublications, ScenicKnowledgePublication publication) {
        if (publication.getId() == null) {
            publication.setId(100L + savedPublications.size());
        }
        publication.setUpdatedAt(LocalDateTime.now());
        savedPublications.add(copy(publication));
        return publication;
    }

    private ScenicStructuredSpotRecord record() {
        ScenicStructuredSpotRecord record = new ScenicStructuredSpotRecord();
        record.setId(8L);
        record.setMatchedFacilityId(12L);
        record.setApplyStatus("applied");
        record.setSpot_name("导入景点名");
        record.setCore_function("导入核心功能");
        record.setDetailed_introduction("导入暂存简介");
        return record;
    }

    private ScenicFacility facility() {
        ScenicFacility facility = new ScenicFacility();
        facility.setId(12L);
        facility.setSpotCode("LS-001");
        facility.setName("正式景点名");
        facility.setShortDescription("正式景点简介");
        facility.setLocationDescription("秦履峰南侧");
        FacilityCategory category = new FacilityCategory();
        category.setId(5L);
        category.setName("佛教景观");
        facility.setCategory(category);
        return facility;
    }

    private ScenicFacilityDetail detail() {
        ScenicFacilityDetail detail = new ScenicFacilityDetail();
        detail.setCoreFunction("正式核心功能");
        detail.setDetailedIntroduction("正式详细介绍");
        detail.setRemark("正式备注");
        detail.setContentVersion(7);
        return detail;
    }

    private ScenicKnowledgePublishRequest publishRequest() {
        ScenicKnowledgePublishRequest request = new ScenicKnowledgePublishRequest();
        request.setAccountId(3L);
        request.setKnowledgeId("kb-1");
        request.setKnowledgeName("灵山知识库");
        return request;
    }

    private AuthSession admin() {
        return new AuthSession(9L, "admin", "管理员", UserRole.ADMIN);
    }

    private ScenicKnowledgePublication publication(
            Long facilityId,
            Long accountId,
            String knowledgeId,
            String knowledgeName,
            String documentId,
            String hash,
            int version,
            String status) {
        ScenicKnowledgePublication publication = new ScenicKnowledgePublication();
        publication.setId(99L);
        publication.setFacilityId(facilityId);
        publication.setAccountId(accountId);
        publication.setKnowledgeId(knowledgeId);
        publication.setKnowledgeName(knowledgeName);
        publication.setDocumentId(documentId);
        publication.setLogicalKey("scenic:" + facilityId + ":" + knowledgeId + ":" + hash);
        publication.setContentHash(hash);
        publication.setPublishSlot(ScenicKnowledgePublication.PUBLISH_SLOT_ACTIVE_REMOTE);
        publication.setVersion(version);
        publication.setStatus(status);
        publication.setPublishedBy("旧管理员");
        publication.setPublishedAt(LocalDateTime.now().minusDays(1));
        publication.setUpdatedAt(LocalDateTime.now().minusDays(1));
        return publication;
    }

    private static ScenicKnowledgePublication copy(ScenicKnowledgePublication publication) {
        ScenicKnowledgePublication copy = new ScenicKnowledgePublication();
        copy.setId(publication.getId());
        copy.setFacilityId(publication.getFacilityId());
        copy.setAccountId(publication.getAccountId());
        copy.setKnowledgeId(publication.getKnowledgeId());
        copy.setKnowledgeName(publication.getKnowledgeName());
        copy.setDocumentId(publication.getDocumentId());
        copy.setLogicalKey(publication.getLogicalKey());
        copy.setContentHash(publication.getContentHash());
        copy.setPublishSlot(publication.getPublishSlot());
        copy.setVersion(publication.getVersion());
        copy.setStatus(publication.getStatus());
        copy.setLastError(publication.getLastError());
        copy.setPublishedBy(publication.getPublishedBy());
        copy.setPublishedAt(publication.getPublishedAt());
        copy.setUpdatedAt(publication.getUpdatedAt());
        return copy;
    }

    private byte[] readAll(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record Fixtures(
            ScenicKnowledgePublicationService service,
            ScenicKnowledgeDocumentRenderer renderer,
            MaxKbKnowledgeService maxKbKnowledgeService,
            ScenicKnowledgePublicationRepository publicationRepository,
            ScenicStructuredSpotRecord record,
            ScenicFacility facility,
            ScenicFacilityDetail detail,
            List<ScenicKnowledgePublication> savedPublications) {
        private ScenicKnowledgePublication capture(ScenicKnowledgePublication publication) {
            if (publication.getId() == null) {
                publication.setId(100L + savedPublications.size());
            }
            publication.setUpdatedAt(LocalDateTime.now());
            savedPublications.add(copy(publication));
            return publication;
        }

        private List<ScenicKnowledgePublication> latestSavedPublications() {
            return savedPublications.stream()
                    .collect(java.util.stream.Collectors.toMap(
                            ScenicKnowledgePublication::getId,
                            publication -> publication,
                            (left, right) -> right,
                            java.util.LinkedHashMap::new))
                    .values()
                    .stream()
                    .toList();
        }
    }
}
