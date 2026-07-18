package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "scenic_structured_application_snapshot")
public class ScenicStructuredApplicationSnapshot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "source_record_id", nullable = false)
    private Long sourceRecordId;
    @Column(name = "facility_id", nullable = false)
    private Long facilityId;
    @Column(name = "facility_snapshot_json", nullable = false, columnDefinition = "LONGTEXT")
    private String facilitySnapshotJson;
    @Column(name = "content_snapshot_json", nullable = false, columnDefinition = "LONGTEXT")
    private String contentSnapshotJson;
    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = LocalDateTime.now(); }
    public Long getId() { return id; }
    public Long getSourceRecordId() { return sourceRecordId; }
    public void setSourceRecordId(Long value) { this.sourceRecordId = value; }
    public Long getFacilityId() { return facilityId; }
    public void setFacilityId(Long value) { this.facilityId = value; }
    public String getFacilitySnapshotJson() { return facilitySnapshotJson; }
    public void setFacilitySnapshotJson(String value) { this.facilitySnapshotJson = value; }
    public String getContentSnapshotJson() { return contentSnapshotJson; }
    public void setContentSnapshotJson(String value) { this.contentSnapshotJson = value; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
