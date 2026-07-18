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
@Table(name = "scenic_facility_presentation")
public class ScenicFacilityPresentation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @OneToOne(optional = false)
    @JoinColumn(name = "facility_id", nullable = false, unique = true)
    private ScenicFacility facility;
    @Column(name = "audio_enabled", nullable = false)
    private Boolean audioEnabled = false;
    @Column(name = "live_enabled", nullable = false)
    private Boolean liveEnabled = false;
    @Column(name = "default_experience", length = 20)
    private String defaultExperience;
    @Column(name = "bound_voice_script_id")
    private Long boundVoiceScriptId;
    @Column(name = "live_source_type", length = 20)
    private String liveSourceType;
    @Column(name = "live_video_url", length = 1000)
    private String liveVideoUrl;
    @Column(name = "live_stream_url", length = 1000)
    private String liveStreamUrl;
    @Column(name = "camera_stream_key", length = 255)
    private String cameraStreamKey;
    @Column(nullable = false)
    private LocalDateTime createdAt;
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() { LocalDateTime now = LocalDateTime.now(); if (createdAt == null) createdAt = now; updatedAt = now; }
    @PreUpdate
    void preUpdate() { updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public ScenicFacility getFacility() { return facility; }
    public void setFacility(ScenicFacility value) { this.facility = value; }
    public Boolean getAudioEnabled() { return audioEnabled; }
    public void setAudioEnabled(Boolean value) { this.audioEnabled = value; }
    public Boolean getLiveEnabled() { return liveEnabled; }
    public void setLiveEnabled(Boolean value) { this.liveEnabled = value; }
    public String getDefaultExperience() { return defaultExperience; }
    public void setDefaultExperience(String value) { this.defaultExperience = value; }
    public Long getBoundVoiceScriptId() { return boundVoiceScriptId; }
    public void setBoundVoiceScriptId(Long value) { this.boundVoiceScriptId = value; }
    public String getLiveSourceType() { return liveSourceType; }
    public void setLiveSourceType(String value) { this.liveSourceType = value; }
    public String getLiveVideoUrl() { return liveVideoUrl; }
    public void setLiveVideoUrl(String value) { this.liveVideoUrl = value; }
    public String getLiveStreamUrl() { return liveStreamUrl; }
    public void setLiveStreamUrl(String value) { this.liveStreamUrl = value; }
    public String getCameraStreamKey() { return cameraStreamKey; }
    public void setCameraStreamKey(String value) { this.cameraStreamKey = value; }
}
