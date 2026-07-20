package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "travel_analytics_snapshot_batch")
public class TravelAnalyticsSnapshotBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private TravelAnalyticsSnapshotBatchStatus status;

    @Column(name = "source_data_version", nullable = false)
    private Long sourceDataVersion = 0L;

    @Column(name = "metric_config_version", nullable = false)
    private Long metricConfigVersion = 0L;

    @Column(name = "source_record_count")
    private Long sourceRecordCount;

    @Column(name = "source_max_updated_at")
    private LocalDateTime sourceMaxUpdatedAt;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "created_by_display_name", length = 100)
    private String createdByDisplayName;

    @Column(name = "failure_summary", columnDefinition = "LONGTEXT")
    private String failureSummary;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public TravelAnalyticsSnapshotBatchStatus getStatus() {
        return status;
    }

    public void setStatus(TravelAnalyticsSnapshotBatchStatus status) {
        this.status = status;
    }

    public Long getSourceDataVersion() {
        return sourceDataVersion;
    }

    public void setSourceDataVersion(Long sourceDataVersion) {
        this.sourceDataVersion = sourceDataVersion;
    }

    public Long getMetricConfigVersion() {
        return metricConfigVersion;
    }

    public void setMetricConfigVersion(Long metricConfigVersion) {
        this.metricConfigVersion = metricConfigVersion;
    }

    public Long getSourceRecordCount() {
        return sourceRecordCount;
    }

    public void setSourceRecordCount(Long sourceRecordCount) {
        this.sourceRecordCount = sourceRecordCount;
    }

    public LocalDateTime getSourceMaxUpdatedAt() {
        return sourceMaxUpdatedAt;
    }

    public void setSourceMaxUpdatedAt(LocalDateTime sourceMaxUpdatedAt) {
        this.sourceMaxUpdatedAt = sourceMaxUpdatedAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getCreatedByDisplayName() {
        return createdByDisplayName;
    }

    public void setCreatedByDisplayName(String createdByDisplayName) {
        this.createdByDisplayName = createdByDisplayName;
    }

    public String getFailureSummary() {
        return failureSummary;
    }

    public void setFailureSummary(String failureSummary) {
        this.failureSummary = failureSummary;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }
}
