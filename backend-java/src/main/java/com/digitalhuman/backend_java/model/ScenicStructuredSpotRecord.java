package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "scenic_spot_structured_record")
public class ScenicStructuredSpotRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scenic_name", length = 255)
    private String scenic_name;

    @Column(name = "spot_id", nullable = false, length = 100)
    private String spot_id;

    @Column(name = "spot_name", length = 255)
    private String spot_name;

    @Column(name = "location", length = 500)
    private String location;

    @Column(name = "architecture_landscape_params", columnDefinition = "LONGTEXT")
    private String architecture_landscape_params;

    @Column(name = "core_function", columnDefinition = "LONGTEXT")
    private String core_function;

    @Column(name = "cultural_connotation", columnDefinition = "LONGTEXT")
    private String cultural_connotation;

    @Column(name = "detailed_introduction", columnDefinition = "LONGTEXT")
    private String detailed_introduction;

    @Column(name = "highlights", columnDefinition = "LONGTEXT")
    private String highlights;

    @Column(name = "performance_open_info", columnDefinition = "LONGTEXT")
    private String performance_open_info;

    @Column(name = "remark", columnDefinition = "LONGTEXT")
    private String remark;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getScenic_name() {
        return scenic_name;
    }

    public void setScenic_name(String scenic_name) {
        this.scenic_name = scenic_name;
    }

    public String getSpot_id() {
        return spot_id;
    }

    public void setSpot_id(String spot_id) {
        this.spot_id = spot_id;
    }

    public String getSpot_name() {
        return spot_name;
    }

    public void setSpot_name(String spot_name) {
        this.spot_name = spot_name;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getArchitecture_landscape_params() {
        return architecture_landscape_params;
    }

    public void setArchitecture_landscape_params(String architecture_landscape_params) {
        this.architecture_landscape_params = architecture_landscape_params;
    }

    public String getCore_function() {
        return core_function;
    }

    public void setCore_function(String core_function) {
        this.core_function = core_function;
    }

    public String getCultural_connotation() {
        return cultural_connotation;
    }

    public void setCultural_connotation(String cultural_connotation) {
        this.cultural_connotation = cultural_connotation;
    }

    public String getDetailed_introduction() {
        return detailed_introduction;
    }

    public void setDetailed_introduction(String detailed_introduction) {
        this.detailed_introduction = detailed_introduction;
    }

    public String getHighlights() {
        return highlights;
    }

    public void setHighlights(String highlights) {
        this.highlights = highlights;
    }

    public String getPerformance_open_info() {
        return performance_open_info;
    }

    public void setPerformance_open_info(String performance_open_info) {
        this.performance_open_info = performance_open_info;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
