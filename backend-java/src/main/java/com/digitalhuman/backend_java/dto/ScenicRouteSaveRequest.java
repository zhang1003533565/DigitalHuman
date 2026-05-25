package com.digitalhuman.backend_java.dto;

import java.util.ArrayList;
import java.util.List;

public class ScenicRouteSaveRequest {

    private String id;
    private String name;
    private String suitableFor;
    private String duration;
    private String distance;
    private String intensity;
    private String reason;
    private String bestTime;
    private Integer sortOrder;
    private Boolean enabled;
    private List<String> tags = new ArrayList<>();
    private List<RouteNodeRequest> nodes = new ArrayList<>();
    private List<RouteFacilityRequest> facilities = new ArrayList<>();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSuitableFor() {
        return suitableFor;
    }

    public void setSuitableFor(String suitableFor) {
        this.suitableFor = suitableFor;
    }

    public String getDuration() {
        return duration;
    }

    public void setDuration(String duration) {
        this.duration = duration;
    }

    public String getDistance() {
        return distance;
    }

    public void setDistance(String distance) {
        this.distance = distance;
    }

    public String getIntensity() {
        return intensity;
    }

    public void setIntensity(String intensity) {
        this.intensity = intensity;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getBestTime() {
        return bestTime;
    }

    public void setBestTime(String bestTime) {
        this.bestTime = bestTime;
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

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags == null ? new ArrayList<>() : tags;
    }

    public List<RouteNodeRequest> getNodes() {
        return nodes;
    }

    public void setNodes(List<RouteNodeRequest> nodes) {
        this.nodes = nodes == null ? new ArrayList<>() : nodes;
    }

    public List<RouteFacilityRequest> getFacilities() {
        return facilities;
    }

    public void setFacilities(List<RouteFacilityRequest> facilities) {
        this.facilities = facilities == null ? new ArrayList<>() : facilities;
    }

    public static class RouteNodeRequest {
        private String id;
        private String name;
        private String type;
        private String spotRefId;
        private String stay;
        private String summary;
        private Boolean required;
        private CoordinateRequest coordinate;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
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

        public Boolean getRequired() {
            return required;
        }

        public void setRequired(Boolean required) {
            this.required = required;
        }

        public CoordinateRequest getCoordinate() {
            return coordinate;
        }

        public void setCoordinate(CoordinateRequest coordinate) {
            this.coordinate = coordinate;
        }
    }

    public static class RouteFacilityRequest {
        private String id;
        private String name;
        private String linkedFacilityId;
        private String category;
        private String nearNode;
        private String nearNodeId;
        private String distance;
        private CoordinateRequest coordinate;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
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

        public CoordinateRequest getCoordinate() {
            return coordinate;
        }

        public void setCoordinate(CoordinateRequest coordinate) {
            this.coordinate = coordinate;
        }
    }

    public static class CoordinateRequest {
        private Double longitude;
        private Double latitude;

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
}
