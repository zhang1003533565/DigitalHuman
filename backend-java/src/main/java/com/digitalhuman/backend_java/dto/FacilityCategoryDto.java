package com.digitalhuman.backend_java.dto;

public class FacilityCategoryDto {

    private Long id;
    private String name;
    private Integer sortOrder;
    private Boolean mapVisible;

    public FacilityCategoryDto() {
    }

    public FacilityCategoryDto(Long id, String name, Integer sortOrder) {
        this(id, name, sortOrder, true);
    }

    public FacilityCategoryDto(Long id, String name, Integer sortOrder, Boolean mapVisible) {
        this.id = id;
        this.name = name;
        this.sortOrder = sortOrder;
        this.mapVisible = mapVisible;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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
