package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class VoiceScriptSynthesizeRequest {

    @NotBlank(message = "音色不能为空")
    private String voiceId;

    @Pattern(regexp = "^[+-]\\d{1,3}%$", message = "语速格式应为百分比，例如 +0%")
    private String speechRate = "+0%";

    @Pattern(regexp = "^[+-]\\d{1,3}%$", message = "音量格式应为百分比，例如 +0%")
    private String speechVolume = "+0%";

    @Pattern(regexp = "^[+-]\\d{1,4}Hz$", message = "语调格式应为赫兹，例如 +0Hz")
    private String speechPitch = "+0Hz";

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
}
