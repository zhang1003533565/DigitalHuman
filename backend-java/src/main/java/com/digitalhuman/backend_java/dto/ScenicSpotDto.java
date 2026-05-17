package com.digitalhuman.backend_java.dto;

import java.util.List;

public class ScenicSpotDto {

    private final String id;
    private final String area;
    private final String name;
    private final String description;
    private final String openHours;
    private final List<String> tags;

    public ScenicSpotDto(String id, String area, String name, String description, String openHours, List<String> tags) {
        this.id = id;
        this.area = area;
        this.name = name;
        this.description = description;
        this.openHours = openHours;
        this.tags = tags;
    }

    public String getId() {
        return id;
    }

    public String getArea() {
        return area;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getOpenHours() {
        return openHours;
    }

    public List<String> getTags() {
        return tags;
    }
}
