package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "scenic_facility_details")
public class ScenicFacilityDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false)
    @JoinColumn(name = "facility_id", nullable = false, unique = true)
    private ScenicFacility facility;

    @Column(name = "architecture_landscape_params", columnDefinition = "LONGTEXT")
    private String architectureLandscapeParams;
    @Column(name = "core_function", columnDefinition = "LONGTEXT")
    private String coreFunction;
    @Column(name = "cultural_connotation", columnDefinition = "LONGTEXT")
    private String culturalConnotation;
    @Column(name = "detailed_introduction", columnDefinition = "LONGTEXT")
    private String detailedIntroduction;
    @Column(columnDefinition = "LONGTEXT")
    private String highlights;
    @Column(name = "performance_open_info", columnDefinition = "LONGTEXT")
    private String performanceOpenInfo;
    @Column(name = "visitor_notes", columnDefinition = "LONGTEXT")
    private String visitorNotes;
    @Column(columnDefinition = "LONGTEXT")
    private String remark;
    @Column(name = "source_record_id")
    private Long sourceRecordId;
    @Column(name = "content_version", nullable = false)
    private Integer contentVersion = 1;
    @Column(nullable = false)
    private LocalDateTime createdAt;
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public ScenicFacility getFacility() { return facility; }
    public void setFacility(ScenicFacility facility) { this.facility = facility; }
    public String getArchitectureLandscapeParams() { return architectureLandscapeParams; }
    public void setArchitectureLandscapeParams(String value) { this.architectureLandscapeParams = value; }
    public String getCoreFunction() { return coreFunction; }
    public void setCoreFunction(String value) { this.coreFunction = value; }
    public String getCulturalConnotation() { return culturalConnotation; }
    public void setCulturalConnotation(String value) { this.culturalConnotation = value; }
    public String getDetailedIntroduction() { return detailedIntroduction; }
    public void setDetailedIntroduction(String value) { this.detailedIntroduction = value; }
    public String getHighlights() { return highlights; }
    public void setHighlights(String value) { this.highlights = value; }
    public String getPerformanceOpenInfo() { return performanceOpenInfo; }
    public void setPerformanceOpenInfo(String value) { this.performanceOpenInfo = value; }
    public String getVisitorNotes() { return visitorNotes; }
    public void setVisitorNotes(String value) { this.visitorNotes = value; }
    public String getRemark() { return remark; }
    public void setRemark(String value) { this.remark = value; }
    public Long getSourceRecordId() { return sourceRecordId; }
    public void setSourceRecordId(Long value) { this.sourceRecordId = value; }
    public Integer getContentVersion() { return contentVersion; }
    public void setContentVersion(Integer value) { this.contentVersion = value; }
}
