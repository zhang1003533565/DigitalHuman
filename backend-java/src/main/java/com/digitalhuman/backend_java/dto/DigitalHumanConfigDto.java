package com.digitalhuman.backend_java.dto;

public class DigitalHumanConfigDto {
    private String modelId;
    private String voiceId;
    private Integer rate;
    private Integer volume;
    private Integer pitch;
    private String welcomeText;
    private String guideStyle;
    private String broadcastStrategy;

    public DigitalHumanConfigDto() {
    }

    public DigitalHumanConfigDto(String modelId, String voiceId, Integer rate, Integer volume, Integer pitch, String welcomeText, String guideStyle, String broadcastStrategy) {
        this.modelId = modelId;
        this.voiceId = voiceId;
        this.rate = rate;
        this.volume = volume;
        this.pitch = pitch;
        this.welcomeText = welcomeText;
        this.guideStyle = guideStyle;
        this.broadcastStrategy = broadcastStrategy;
    }

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
