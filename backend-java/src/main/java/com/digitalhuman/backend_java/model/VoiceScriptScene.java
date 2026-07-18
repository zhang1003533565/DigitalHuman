package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "voice_script_scene",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_voice_scene_key",
                        columnNames = {"spot_id", "scene_type", "style", "version_no"}
                )
        }
)
public class VoiceScriptScene {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "facility_id")
    private Long facilityId;

    @Column(name = "scenic_name", nullable = false, length = 255)
    private String scenicName;

    @Column(name = "spot_id", nullable = false, length = 100)
    private String spotId;

    @Column(name = "spot_name", length = 255)
    private String spotName;

    @Column(name = "scene_type", nullable = false, length = 30)
    private String sceneType;

    @Column(name = "style", nullable = false, length = 30)
    private String style;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "script_text", nullable = false, columnDefinition = "LONGTEXT")
    private String scriptText;

    @Column(name = "ssml_text", columnDefinition = "LONGTEXT")
    private String ssmlText;

    @Column(name = "duration_sec", nullable = false)
    private Integer durationSec;

    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "source_file", length = 255)
    private String sourceFile;

    @Column(name = "generation_mode", length = 20)
    private String generationMode;

    @Column(name = "target_duration_sec")
    private Integer targetDurationSec;

    @Column(name = "source_refs_json", columnDefinition = "LONGTEXT")
    private String sourceRefsJson;

    @Column(name = "audio_status", length = 20)
    private String audioStatus;

    @Column(name = "audio_url", length = 1000)
    private String audioUrl;

    @Column(name = "audio_file_name", length = 255)
    private String audioFileName;

    @Column(name = "voice_id", length = 100)
    private String voiceId;

    @Column(name = "speech_rate", length = 30)
    private String speechRate;

    @Column(name = "speech_volume", length = 30)
    private String speechVolume;

    @Column(name = "speech_pitch", length = 30)
    private String speechPitch;

    @Column(name = "audio_script_hash", length = 64)
    private String audioScriptHash;

    @Column(name = "audio_generated_at")
    private LocalDateTime audioGeneratedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        applyLegacyDefaults();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PostLoad
    public void postLoad() {
        applyLegacyDefaults();
    }

    private void applyLegacyDefaults() {
        if (generationMode == null || generationMode.isBlank()) {
            generationMode = "manual";
        }
        if (audioStatus == null || audioStatus.isBlank()) {
            audioStatus = "missing";
        }
        if (targetDurationSec == null) {
            targetDurationSec = durationSec;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getFacilityId() {
        return facilityId;
    }

    public void setFacilityId(Long facilityId) {
        this.facilityId = facilityId;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getScenicName() {
        return scenicName;
    }

    public void setScenicName(String scenicName) {
        this.scenicName = scenicName;
    }

    public String getSpotId() {
        return spotId;
    }

    public void setSpotId(String spotId) {
        this.spotId = spotId;
    }

    public String getSpotName() {
        return spotName;
    }

    public void setSpotName(String spotName) {
        this.spotName = spotName;
    }

    public String getSceneType() {
        return sceneType;
    }

    public void setSceneType(String sceneType) {
        this.sceneType = sceneType;
    }

    public String getStyle() {
        return style;
    }

    public void setStyle(String style) {
        this.style = style;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getScriptText() {
        return scriptText;
    }

    public void setScriptText(String scriptText) {
        this.scriptText = scriptText;
    }

    public String getSsmlText() {
        return ssmlText;
    }

    public void setSsmlText(String ssmlText) {
        this.ssmlText = ssmlText;
    }

    public Integer getDurationSec() {
        return durationSec;
    }

    public void setDurationSec(Integer durationSec) {
        this.durationSec = durationSec;
    }

    public Integer getVersionNo() {
        return versionNo;
    }

    public void setVersionNo(Integer versionNo) {
        this.versionNo = versionNo;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getSourceFile() {
        return sourceFile;
    }

    public void setSourceFile(String sourceFile) {
        this.sourceFile = sourceFile;
    }

    public String getGenerationMode() {
        return generationMode;
    }

    public void setGenerationMode(String generationMode) {
        this.generationMode = generationMode;
    }

    public Integer getTargetDurationSec() {
        return targetDurationSec;
    }

    public void setTargetDurationSec(Integer targetDurationSec) {
        this.targetDurationSec = targetDurationSec;
    }

    public String getSourceRefsJson() {
        return sourceRefsJson;
    }

    public void setSourceRefsJson(String sourceRefsJson) {
        this.sourceRefsJson = sourceRefsJson;
    }

    public String getAudioStatus() {
        return audioStatus;
    }

    public void setAudioStatus(String audioStatus) {
        this.audioStatus = audioStatus;
    }

    public String getAudioUrl() {
        return audioUrl;
    }

    public void setAudioUrl(String audioUrl) {
        this.audioUrl = audioUrl;
    }

    public String getAudioFileName() {
        return audioFileName;
    }

    public void setAudioFileName(String audioFileName) {
        this.audioFileName = audioFileName;
    }

    public String getVoiceId() {
        return voiceId;
    }

    public void setVoiceId(String voiceId) {
        this.voiceId = voiceId;
    }

    public String getSpeechRate() {
        return speechRate;
    }

    public void setSpeechRate(String speechRate) {
        this.speechRate = speechRate;
    }

    public String getSpeechVolume() {
        return speechVolume;
    }

    public void setSpeechVolume(String speechVolume) {
        this.speechVolume = speechVolume;
    }

    public String getSpeechPitch() {
        return speechPitch;
    }

    public void setSpeechPitch(String speechPitch) {
        this.speechPitch = speechPitch;
    }

    public String getAudioScriptHash() {
        return audioScriptHash;
    }

    public void setAudioScriptHash(String audioScriptHash) {
        this.audioScriptHash = audioScriptHash;
    }

    public LocalDateTime getAudioGeneratedAt() {
        return audioGeneratedAt;
    }

    public void setAudioGeneratedAt(LocalDateTime audioGeneratedAt) {
        this.audioGeneratedAt = audioGeneratedAt;
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
