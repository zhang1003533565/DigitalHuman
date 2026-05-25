package com.digitalhuman.backend_java.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "digital_human_config")
public class DigitalHumanConfig {
    @Id
    private Long id = 1L;

    private String modelId = "hiyori_pro_zh";
    private String voiceId = "zh-CN-XiaoxiaoNeural";
    private Integer rate = 0;
    private Integer volume = 0;
    private Integer pitch = 0;
    private String welcomeText = "您好，欢迎来到灵山胜境，我可以为您介绍景点、路线和活动安排。";
    private String guideStyle = "friendly";
    private String broadcastStrategy = "standard";

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getModelId() { return modelId; }
    public void setModelId(String modelId) { this.modelId = modelId; }
    public String getVoiceId() { return voiceId; }
    public void setVoiceId(String voiceId) { this.voiceId = voiceId; }
    public Integer getRate() { return rate; }
    public void setRate(Integer rate) { this.rate = rate; }
    public Integer getVolume() { return volume; }
    public void setVolume(Integer volume) { this.volume = volume; }
    public Integer getPitch() { return pitch; }
    public void setPitch(Integer pitch) { this.pitch = pitch; }
    public String getWelcomeText() { return welcomeText; }
    public void setWelcomeText(String welcomeText) { this.welcomeText = welcomeText; }
    public String getGuideStyle() { return guideStyle; }
    public void setGuideStyle(String guideStyle) { this.guideStyle = guideStyle; }
    public String getBroadcastStrategy() { return broadcastStrategy; }
    public void setBroadcastStrategy(String broadcastStrategy) { this.broadcastStrategy = broadcastStrategy; }
}
