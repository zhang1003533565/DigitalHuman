package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatch;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatchStatus;
import com.digitalhuman.backend_java.repository.TravelAnalyticsSnapshotBatchRepository;
import jakarta.persistence.LockTimeoutException;
import jakarta.persistence.PessimisticLockException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Objects;
import java.util.Set;

import static org.springframework.http.HttpStatus.CONFLICT;

@Service
public class TravelAnalyticsSnapshotLifecycleService {

    private final TravelAnalyticsSnapshotBatchRepository batchRepository;
    private final TravelAnalyticsSourceStateService sourceStateService;

    public TravelAnalyticsSnapshotLifecycleService(
            TravelAnalyticsSnapshotBatchRepository batchRepository,
            TravelAnalyticsSourceStateService sourceStateService) {
        this.batchRepository = Objects.requireNonNull(batchRepository, "batchRepository");
        this.sourceStateService = Objects.requireNonNull(sourceStateService, "sourceStateService");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public TravelAnalyticsSnapshotBatch createBuilding(AuthSession admin) {
        Objects.requireNonNull(admin, "admin");
        lockSourceStateOrThrowConflict();
        if (batchRepository.findFirstByStatusOrderByCreatedAtDescIdDesc(
                TravelAnalyticsSnapshotBatchStatus.BUILDING).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "统计快照正在生成");
        }

        TravelAnalyticsSnapshotBatch batch = new TravelAnalyticsSnapshotBatch();
        batch.setStatus(TravelAnalyticsSnapshotBatchStatus.BUILDING);
        batch.setCreatedBy(admin.getUsername());
        batch.setCreatedByDisplayName(admin.getDisplayName());
        return batchRepository.saveAndFlush(batch);
    }

    private void lockSourceStateOrThrowConflict() {
        try {
            sourceStateService.lockState();
        } catch (RuntimeException failure) {
            if (isPessimisticLockFailure(failure)) {
                throw new ResponseStatusException(CONFLICT, "统计快照正在生成", failure);
            }
            throw failure;
        }
    }

    private boolean isPessimisticLockFailure(Throwable failure) {
        Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        for (Throwable cause = failure; cause != null && visited.add(cause); cause = cause.getCause()) {
            if (cause instanceof PessimisticLockingFailureException
                    || cause instanceof PessimisticLockException
                    || cause instanceof LockTimeoutException) {
                return true;
            }
        }
        return false;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long batchId, String failureSummary) {
        TravelAnalyticsSnapshotBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalStateException("统计快照批次不存在"));
        if (batch.getStatus() != TravelAnalyticsSnapshotBatchStatus.BUILDING) {
            return;
        }
        batch.setStatus(TravelAnalyticsSnapshotBatchStatus.FAILED);
        batch.setFailureSummary(failureSummary);
        batch.setCompletedAt(LocalDateTime.now());
        batchRepository.saveAndFlush(batch);
    }
}
