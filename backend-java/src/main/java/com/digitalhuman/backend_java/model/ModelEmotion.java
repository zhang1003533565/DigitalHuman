package com.digitalhuman.backend_java.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "model_emotion",
       uniqueConstraints = @UniqueConstraint(columnNames = {"model_id", "emotion_id"}))
public class ModelEmotion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id", nullable = false)
    private DigitalHumanModel model;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "emotion_id", nullable = false)
    private Emotion emotion;

    @Column
    private Boolean enabled = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "modelEmotion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ModelEmotionAction> emotionActions;

    public ModelEmotion() {
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

    public DigitalHumanModel getModel() {
        return model;
    }

    public void setModel(DigitalHumanModel model) {
        this.model = model;
    }

    public Emotion getEmotion() {
        return emotion;
    }

    public void setEmotion(Emotion emotion) {
        this.emotion = emotion;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public List<ModelEmotionAction> getEmotionActions() {
        return emotionActions;
    }

    public void setEmotionActions(List<ModelEmotionAction> emotionActions) {
        this.emotionActions = emotionActions;
    }
}
