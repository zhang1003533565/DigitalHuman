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

    @Column(name = "total_samples", nullable = false)
    private Long totalSamples;

    @Column(name = "valid_samples", nullable = false)
    private Long validSamples;

    @Column(name = "as_of", nullable = false)
    private LocalDateTime asOf;

    @Column(name = "methodology", nullable = false, columnDefinition = "LONGTEXT")
    private String methodology;

    @Column(name = "warning", columnDefinition = "LONGTEXT")
    private String warning;

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

    public Long getTotalSamples() {
        return totalSamples;
    }

    public void setTotalSamples(Long totalSamples) {
        this.totalSamples = totalSamples;
    }

    public Long getValidSamples() {
        return validSamples;
    }

    public void setValidSamples(Long validSamples) {
        this.validSamples = validSamples;
    }

    public LocalDateTime getAsOf() {
        return asOf;
    }

    public void setAsOf(LocalDateTime asOf) {
        this.asOf = asOf;
    }

    public String getMethodology() {
        return methodology;
    }

    public void setMethodology(String methodology) {
        this.methodology = methodology;
    }

    public String getWarning() {
        return warning;
    }

    public void setWarning(String warning) {
        this.warning = warning;
    }
}
