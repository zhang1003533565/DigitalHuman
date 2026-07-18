package com.digitalhuman.backend_java.dto;

public class ScenicFacilityContentRequest {
    private String architectureLandscapeParams;
    private String coreFunction;
    private String culturalConnotation;
    private String detailedIntroduction;
    private String highlights;
    private String performanceOpenInfo;
    private String visitorNotes;
    private String remark;
    private Long sourceRecordId;
    private Boolean audioEnabled = false;
    private Boolean liveEnabled = false;
    private String defaultExperience;
    private Long boundVoiceScriptId;
    private String liveSourceType;
    private String liveVideoUrl;
    private String liveStreamUrl;
    private String cameraStreamKey;

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
