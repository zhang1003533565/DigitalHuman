package com.digitalhuman.backend_java.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "model_emotion_action",
       uniqueConstraints = @UniqueConstraint(columnNames = {"model_emotion_id", "model_action_id"}))
public class ModelEmotionAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_emotion_id", nullable = false)
    private ModelEmotion modelEmotion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_action_id", nullable = false)
    private ModelAction modelAction;

    @Column
    private Integer priority = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public ModelEmotionAction() {
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public ModelEmotion getModelEmotion() {
        return modelEmotion;
    }

    public void setModelEmotion(ModelEmotion modelEmotion) {
        this.modelEmotion = modelEmotion;
    }

    public ModelAction getModelAction() {
        return modelAction;
    }

    public void setModelAction(ModelAction modelAction) {
        this.modelAction = modelAction;
    }

    public Integer getPriority() {
        return priority;
    }

    public void setPriority(Integer priority) {
        this.priority = priority;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
