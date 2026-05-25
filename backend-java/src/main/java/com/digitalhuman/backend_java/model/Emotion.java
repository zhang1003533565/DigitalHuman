package com.digitalhuman.backend_java.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "emotion")
public class Emotion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "emotion_key", nullable = false, unique = true, length = 50)
    private String emotionKey;

    @Column(name = "emotion_name", nullable = false, length = 100)
    private String emotionName;

    @Column(name = "emotion_icon", length = 100)
    private String emotionIcon;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @Column
    private Boolean enabled = true;

    @Column(name = "voice_prompt_template", columnDefinition = "TEXT")
    private String voicePromptTemplate;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "emotion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ModelEmotion> modelEmotions;

    public Emotion() {
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmotionKey() {
        return emotionKey;
    }

    public void setEmotionKey(String emotionKey) {
        this.emotionKey = emotionKey;
    }

    public String getEmotionName() {
        return emotionName;
    }

    public void setEmotionName(String emotionName) {
        this.emotionName = emotionName;
    }

    public String getEmotionIcon() {
        return emotionIcon;
    }

    public void setEmotionIcon(String emotionIcon) {
        this.emotionIcon = emotionIcon;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public String getVoicePromptTemplate() {
        return voicePromptTemplate;
    }

    public void setVoicePromptTemplate(String voicePromptTemplate) {
        this.voicePromptTemplate = voicePromptTemplate;
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

    public List<ModelEmotion> getModelEmotions() {
        return modelEmotions;
    }

    public void setModelEmotions(List<ModelEmotion> modelEmotions) {
        this.modelEmotions = modelEmotions;
    }
}
