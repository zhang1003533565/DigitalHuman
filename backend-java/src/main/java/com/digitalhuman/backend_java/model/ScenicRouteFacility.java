package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "scenic_route_facility")
public class ScenicRouteFacility {

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

    @Column(length = 64)
    private String linkedFacilityId;

    @Column(nullable = false, length = 30)
    private String category;

    @Column(length = 100)
    private String nearNode;

    @Column(length = 64)
    private String nearNodeId;

    @Column(length = 30)
    private String distance;

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

    public String getLinkedFacilityId() {
        return linkedFacilityId;
    }

    public void setLinkedFacilityId(String linkedFacilityId) {
        this.linkedFacilityId = linkedFacilityId;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getNearNode() {
        return nearNode;
    }

    public void setNearNode(String nearNode) {
        this.nearNode = nearNode;
    }

    public String getNearNodeId() {
        return nearNodeId;
    }

    public void setNearNodeId(String nearNodeId) {
        this.nearNodeId = nearNodeId;
    }

    public String getDistance() {
        return distance;
    }

    public void setDistance(String distance) {
        this.distance = distance;
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
