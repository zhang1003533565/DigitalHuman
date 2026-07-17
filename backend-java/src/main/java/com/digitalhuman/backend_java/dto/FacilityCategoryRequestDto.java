package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.NotBlank;

public class FacilityCategoryRequestDto {

    @NotBlank(message = "Category name must not be blank")
    private String name;

    private Integer sortOrder;

    private Boolean mapVisible;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Boolean getMapVisible() {
        return mapVisible;
    }

    public void setMapVisible(Boolean mapVisible) {
        this.mapVisible = mapVisible;
    }
}
