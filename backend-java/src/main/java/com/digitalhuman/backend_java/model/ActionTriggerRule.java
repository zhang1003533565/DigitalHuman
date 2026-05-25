package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "action_trigger_rule")
public class ActionTriggerRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id", nullable = false)
    private DigitalHumanModel model;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_action_id", nullable = false)
    private ModelAction modelAction;

    @Column(name = "rule_type", nullable = false, length = 20)
    private String ruleType;

    @Column(name = "event_code", length = 50)
    private String eventCode;

    @Column(name = "phrases_json", columnDefinition = "TEXT")
    private String phrasesJson;

    @Column
    private Boolean enabled = true;

    @Column
    private Integer priority = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

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

    public DigitalHumanModel getModel() {
        return model;
    }

    public void setModel(DigitalHumanModel model) {
        this.model = model;
    }

    public ModelAction getModelAction() {
        return modelAction;
    }

    public void setModelAction(ModelAction modelAction) {
        this.modelAction = modelAction;
    }

    public String getRuleType() {
        return ruleType;
    }

    public void setRuleType(String ruleType) {
        this.ruleType = ruleType;
    }

    public String getEventCode() {
        return eventCode;
    }

    public void setEventCode(String eventCode) {
        this.eventCode = eventCode;
    }

    public String getPhrasesJson() {
        return phrasesJson;
    }

    public void setPhrasesJson(String phrasesJson) {
        this.phrasesJson = phrasesJson;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
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

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
