package com.digitalhuman.backend_java.dto;

import java.util.List;

public class ScenicRouteDto {

    private final String id;
    private final String name;
    private final String suitableFor;
    private final String duration;
    private final String reason;
    private final List<String> spots;

    public ScenicRouteDto(String id, String name, String suitableFor, String duration, String reason, List<String> spots) {
        this.id = id;
        this.name = name;
        this.suitableFor = suitableFor;
        this.duration = duration;
        this.reason = reason;
        this.spots = spots;
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

    public String getReason() {
        return reason;
    }

    public List<String> getSpots() {
        return spots;
    }
}
