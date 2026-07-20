package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "travel_analytics_ai_config")
public class TravelAnalyticsAiConfig {

    @Id
    @Column(length = 32)
    private String id = "default";

    @Column(nullable = false)
    private Boolean publicEnabled = true;

    @Column(nullable = false)
    private Integer minimumSampleSize = 10;

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Boolean getPublicEnabled() {
        return publicEnabled;
    }

    public void setPublicEnabled(Boolean publicEnabled) {
        this.publicEnabled = publicEnabled;
    }

    public Integer getMinimumSampleSize() {
        return minimumSampleSize;
    }

    public void setMinimumSampleSize(Integer minimumSampleSize) {
        this.minimumSampleSize = minimumSampleSize;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
