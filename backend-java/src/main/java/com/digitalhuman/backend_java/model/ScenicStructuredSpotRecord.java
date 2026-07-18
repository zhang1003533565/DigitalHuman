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

    @Column(name = "matched_facility_id")
    private Long matchedFacilityId;

    @Column(name = "match_status", length = 20)
    private String matchStatus = "unmatched";

    @Column(name = "apply_status", length = 20)
    private String applyStatus = "pending";

    @Column(name = "last_applied_at")
    private LocalDateTime lastAppliedAt;

    @Column(name = "audio_enabled", nullable = false)
    private Boolean audio_enabled = false;

    @Column(name = "live_enabled", nullable = false)
    private Boolean live_enabled = false;

    @Column(name = "default_experience", length = 20)
    private String default_experience;

    @Column(name = "bound_voice_script_id")
    private Long bound_voice_script_id;

    @Column(name = "live_source_type", length = 20)
    private String live_source_type;

    @Column(name = "live_video_url", length = 1000)
    private String live_video_url;

    @Column(name = "live_stream_url", length = 1000)
    private String live_stream_url;

    @Column(name = "camera_stream_key", length = 255)
    private String camera_stream_key;

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

    public Long getMatchedFacilityId() { return matchedFacilityId; }
    public void setMatchedFacilityId(Long value) { this.matchedFacilityId = value; }
    public String getMatchStatus() { return matchStatus; }
    public void setMatchStatus(String value) { this.matchStatus = value; }
    public String getApplyStatus() { return applyStatus; }
    public void setApplyStatus(String value) { this.applyStatus = value; }
    public LocalDateTime getLastAppliedAt() { return lastAppliedAt; }
    public void setLastAppliedAt(LocalDateTime value) { this.lastAppliedAt = value; }

    public Boolean getAudio_enabled() {
        return audio_enabled;
    }

    public void setAudio_enabled(Boolean audio_enabled) {
        this.audio_enabled = audio_enabled;
    }

    public Boolean getLive_enabled() {
        return live_enabled;
    }

    public void setLive_enabled(Boolean live_enabled) {
        this.live_enabled = live_enabled;
    }

    public String getDefault_experience() {
        return default_experience;
    }

    public void setDefault_experience(String default_experience) {
        this.default_experience = default_experience;
    }

    public Long getBound_voice_script_id() {
        return bound_voice_script_id;
    }

    public void setBound_voice_script_id(Long bound_voice_script_id) {
        this.bound_voice_script_id = bound_voice_script_id;
    }

    public String getLive_source_type() {
        return live_source_type;
    }

    public void setLive_source_type(String live_source_type) {
        this.live_source_type = live_source_type;
    }

    public String getLive_video_url() {
        return live_video_url;
    }

    public void setLive_video_url(String live_video_url) {
        this.live_video_url = live_video_url;
    }

    public String getLive_stream_url() {
        return live_stream_url;
    }

    public void setLive_stream_url(String live_stream_url) {
        this.live_stream_url = live_stream_url;
    }

    public String getCamera_stream_key() {
        return camera_stream_key;
    }

    public void setCamera_stream_key(String camera_stream_key) {
        this.camera_stream_key = camera_stream_key;
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
