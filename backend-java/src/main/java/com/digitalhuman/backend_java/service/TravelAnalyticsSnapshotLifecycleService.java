package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatch;
import com.digitalhuman.backend_java.model.TravelAnalyticsSnapshotBatchStatus;
import com.digitalhuman.backend_java.repository.TravelAnalyticsSnapshotBatchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Objects;

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
        sourceStateService.lockState();
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
