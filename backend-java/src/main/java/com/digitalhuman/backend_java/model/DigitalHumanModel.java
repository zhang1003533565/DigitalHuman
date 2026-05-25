package com.digitalhuman.backend_java.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "digital_human_model")
public class DigitalHumanModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "model_key", nullable = false, unique = true, length = 100)
    private String modelKey;

    @Column(name = "display_name", length = 200)
    private String displayName;

    @Column(name = "model_path", nullable = false, length = 500)
    private String modelPath;

    @Column(name = "action_md_path", length = 500)
    private String actionMdPath;

    @Column(length = 20)
    private String status = "active";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "model", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ModelAction> actions;

    @OneToMany(mappedBy = "model", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ModelEmotion> emotions;

    public DigitalHumanModel() {
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

    public String getModelKey() {
        return modelKey;
    }

    public void setModelKey(String modelKey) {
        this.modelKey = modelKey;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getModelPath() {
        return modelPath;
    }

    public void setModelPath(String modelPath) {
        this.modelPath = modelPath;
    }

    public String getActionMdPath() {
        return actionMdPath;
    }

    public void setActionMdPath(String actionMdPath) {
        this.actionMdPath = actionMdPath;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

    public List<ModelAction> getActions() {
        return actions;
    }

    public void setActions(List<ModelAction> actions) {
        this.actions = actions;
    }

    public List<ModelEmotion> getEmotions() {
        return emotions;
    }

    public void setEmotions(List<ModelEmotion> emotions) {
        this.emotions = emotions;
    }
}
