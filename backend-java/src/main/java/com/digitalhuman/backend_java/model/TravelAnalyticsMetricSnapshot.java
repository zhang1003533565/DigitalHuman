package com.digitalhuman.backend_java.model;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "travel_analytics_metric_snapshot",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_travel_analytics_snapshot_metric",
                columnNames = {"batch_id", "scope", "metric"}))
public class TravelAnalyticsMetricSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "batch_id", nullable = false)
    private TravelAnalyticsSnapshotBatch batch;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope", nullable = false, length = 32)
    private TravelAnalyticsAudience scope;

    @Enumerated(EnumType.STRING)
    @Column(name = "metric", nullable = false, length = 64)
    private TravelAnalyticsMetric metric;

    @Column(name = "items_json", nullable = false, columnDefinition = "LONGTEXT")
    private String itemsJson;

    @Column(name = "computed_at", nullable = false)
    private LocalDateTime computedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public TravelAnalyticsSnapshotBatch getBatch() {
        return batch;
    }

    public void setBatch(TravelAnalyticsSnapshotBatch batch) {
        this.batch = batch;
    }

    public TravelAnalyticsAudience getScope() {
        return scope;
    }

    public void setScope(TravelAnalyticsAudience scope) {
        this.scope = scope;
    }

    public TravelAnalyticsMetric getMetric() {
        return metric;
    }

    public void setMetric(TravelAnalyticsMetric metric) {
        this.metric = metric;
    }

    public String getItemsJson() {
        return itemsJson;
    }

    public void setItemsJson(String itemsJson) {
        this.itemsJson = itemsJson;
    }

    public LocalDateTime getComputedAt() {
        return computedAt;
    }

    public void setComputedAt(LocalDateTime computedAt) {
        this.computedAt = computedAt;
    }
}
