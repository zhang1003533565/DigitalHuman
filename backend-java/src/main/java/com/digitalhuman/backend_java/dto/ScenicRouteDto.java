package com.digitalhuman.backend_java.dto;

import java.util.List;

public class ScenicRouteDto {

    private final String id;
    private final String name;
    private final String suitableFor;
    private final String duration;
    private final String distance;
    private final String intensity;
    private final String reason;
    private final String bestTime;
    private final Integer sortOrder;
    private final boolean enabled;
    private final List<String> tags;
    private final List<String> spots;
    private final List<RouteNodeDto> nodes;
    private final List<RouteFacilityDto> facilities;
    private final List<CoordinateDto> polyline;

    public ScenicRouteDto(String id, String name, String suitableFor, String duration, String reason, List<String> spots) {
        this(id, name, suitableFor, duration, "", "", reason, "", List.of(), spots, List.of(), List.of(), List.of());
    }

    public ScenicRouteDto(
            String id,
            String name,
            String suitableFor,
            String duration,
            String distance,
            String intensity,
            String reason,
            String bestTime,
            List<String> tags,
            List<String> spots,
            List<RouteNodeDto> nodes,
            List<RouteFacilityDto> facilities,
            List<CoordinateDto> polyline) {
        this(id, name, suitableFor, duration, distance, intensity, reason, bestTime, 0, true, tags, spots, nodes, facilities, polyline);
    }

    public ScenicRouteDto(
            String id,
            String name,
            String suitableFor,
            String duration,
            String distance,
            String intensity,
            String reason,
            String bestTime,
            Integer sortOrder,
            boolean enabled,
            List<String> tags,
            List<String> spots,
            List<RouteNodeDto> nodes,
            List<RouteFacilityDto> facilities,
            List<CoordinateDto> polyline) {
        this.id = id;
        this.name = name;
        this.suitableFor = suitableFor;
        this.duration = duration;
        this.distance = distance;
        this.intensity = intensity;
        this.reason = reason;
        this.bestTime = bestTime;
        this.sortOrder = sortOrder;
        this.enabled = enabled;
        this.tags = tags;
        this.spots = spots;
        this.nodes = nodes;
        this.facilities = facilities;
        this.polyline = polyline;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getSuitableFor() {
        return suitableFor;
    }

    public String getDuration() {
        return duration;
    }

    public String getDistance() {
        return distance;
    }

    public String getIntensity() {
        return intensity;
    }

    public String getReason() {
        return reason;
    }

    public String getBestTime() {
        return bestTime;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public List<String> getTags() {
        return tags;
    }

    public List<String> getSpots() {
        return spots;
    }

    public List<RouteNodeDto> getNodes() {
        return nodes;
    }

    public List<RouteFacilityDto> getFacilities() {
        return facilities;
    }

    public List<CoordinateDto> getPolyline() {
        return polyline;
    }

    public static class RouteNodeDto {
        private final String id;
        private final String name;
        private final String type;
        private final String spotRefId;
        private final String stay;
        private final String summary;
        private final boolean required;
        private final CoordinateDto coordinate;

        public RouteNodeDto(String id, String name, String type, String stay, String summary, boolean required, CoordinateDto coordinate) {
            this(id, name, type, null, stay, summary, required, coordinate);
        }

        public RouteNodeDto(String id, String name, String type, String spotRefId, String stay, String summary, boolean required, CoordinateDto coordinate) {
            this.id = id;
            this.name = name;
            this.type = type;
            this.spotRefId = spotRefId;
            this.stay = stay;
            this.summary = summary;
            this.required = required;
            this.coordinate = coordinate;
        }

        public String getId() {
            return id;
        }

        public String getName() {
            return name;
        }

        public String getType() {
            return type;
        }

        public String getSpotRefId() {
            return spotRefId;
        }

        public String getStay() {
            return stay;
        }

        public String getSummary() {
            return summary;
        }

        public boolean isRequired() {
            return required;
        }

        public CoordinateDto getCoordinate() {
            return coordinate;
        }
    }

    public static class RouteFacilityDto {
        private final String id;
        private final String name;
        private final String linkedFacilityId;
        private final String category;
        private final String nearNode;
        private final String nearNodeId;
        private final String distance;
        private final CoordinateDto coordinate;

        public RouteFacilityDto(String id, String name, String category, String nearNode, String distance, CoordinateDto coordinate) {
            this(id, name, null, category, nearNode, null, distance, coordinate);
        }

        public RouteFacilityDto(String id, String name, String linkedFacilityId, String category, String nearNode, String nearNodeId, String distance, CoordinateDto coordinate) {
            this.id = id;
            this.name = name;
            this.linkedFacilityId = linkedFacilityId;
            this.category = category;
            this.nearNode = nearNode;
            this.nearNodeId = nearNodeId;
            this.distance = distance;
            this.coordinate = coordinate;
        }

        public String getId() {
            return id;
        }

        public String getName() {
            return name;
        }

        public String getLinkedFacilityId() {
            return linkedFacilityId;
        }

        public String getCategory() {
            return category;
        }

        public String getNearNode() {
            return nearNode;
        }

        public String getNearNodeId() {
            return nearNodeId;
        }

        public String getDistance() {
            return distance;
        }

        public CoordinateDto getCoordinate() {
            return coordinate;
        }
    }

    public static class CoordinateDto {
        private final double longitude;
        private final double latitude;

        public CoordinateDto(double longitude, double latitude) {
            this.longitude = longitude;
            this.latitude = latitude;
        }

        public double getLongitude() {
            return longitude;
        }

        public double getLatitude() {
            return latitude;
        }
    }
}
