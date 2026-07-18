package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class VoiceScriptSceneRequest {

    private Long facilityId;

    @NotBlank(message = "景区名称不能为空")
    private String scenicName;

    @NotBlank(message = "景点ID不能为空")
    private String spotId;

    @NotBlank(message = "景点名称不能为空")
    private String spotName;

    @NotBlank(message = "场景类型不能为空")
    private String sceneType;

    @NotBlank(message = "风格不能为空")
    private String style;

    @NotBlank(message = "标题不能为空")
    private String title;

    @NotBlank(message = "口播文本不能为空")
    @Size(max = 1200, message = "口播文本不能超过1200字")
    private String scriptText;

    private String ssmlText;

    @NotNull(message = "预计时长不能为空")
    @Min(value = 20, message = "预计时长不能小于20秒")
    @Max(value = 900, message = "预计时长不能超过900秒")
    private Integer durationSec;

    @NotNull(message = "版本号不能为空")
    @Min(value = 1, message = "版本号最小为1")
    private Integer versionNo;

    @NotBlank(message = "状态不能为空")
    private String status;

    private String sourceFile;

    public Long getFacilityId() { return facilityId; }
    public void setFacilityId(Long value) { this.facilityId = value; }

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
}
