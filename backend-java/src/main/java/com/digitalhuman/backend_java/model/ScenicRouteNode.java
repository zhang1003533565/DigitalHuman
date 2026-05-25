package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "scenic_route_node")
public class ScenicRouteNode {

    @Id
    @Column(length = 64)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_id", nullable = false)
    private ScenicRoute route;

    @Column(nullable = false)
    private Integer sortOrder = 0;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 30)
    private String type;

    @Column(length = 64)
    private String spotRefId;

    @Column(length = 30)
    private String stay;

    @Column(length = 500)
    private String summary;

    @Column(nullable = false)
    private Boolean requiredNode = true;

    @Column(nullable = false)
    private Double longitude;

    @Column(nullable = false)
    private Double latitude;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public ScenicRoute getRoute() {
        return route;
    }

    public void setRoute(ScenicRoute route) {
        this.route = route;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getSpotRefId() {
        return spotRefId;
    }

    public void setSpotRefId(String spotRefId) {
        this.spotRefId = spotRefId;
    }

    public String getStay() {
        return stay;
    }

    public void setStay(String stay) {
        this.stay = stay;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public Boolean getRequiredNode() {
        return requiredNode;
    }

    public void setRequiredNode(Boolean requiredNode) {
        this.requiredNode = requiredNode;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }
}
