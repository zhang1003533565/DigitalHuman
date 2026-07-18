package com.digitalhuman.backend_java.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public class ScenicFacilityDto {

    private Long id;
    private String spotCode;
    private String name;
    private String shortDescription;
    private String locationDescription;
    private Long categoryId;
    private String categoryName;
    private BigDecimal longitude;
    private BigDecimal latitude;
    private String image;
    private List<String> galleryImages;
    private LocalTime openTime;
    private LocalTime closeTime;
    private Boolean mapVisible;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public ScenicFacilityDto() {
    }

    public ScenicFacilityDto(
            Long id,
            String spotCode,
            String name,
            String shortDescription,
            String locationDescription,
            Long categoryId,
            String categoryName,
            BigDecimal longitude,
            BigDecimal latitude,
            String image,
            List<String> galleryImages,
            LocalTime openTime,
            LocalTime closeTime,
            Boolean mapVisible,
            LocalDateTime createdAt,
            LocalDateTime updatedAt) {
        this.id = id;
        this.spotCode = spotCode;
        this.name = name;
        this.shortDescription = shortDescription;
        this.locationDescription = locationDescription;
        this.categoryId = categoryId;
        this.categoryName = categoryName;
        this.longitude = longitude;
        this.latitude = latitude;
        this.image = image;
        this.galleryImages = galleryImages;
        this.openTime = openTime;
        this.closeTime = closeTime;
        this.mapVisible = mapVisible;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSpotCode() { return spotCode; }
    public void setSpotCode(String value) { this.spotCode = value; }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getShortDescription() { return shortDescription; }
    public void setShortDescription(String value) { this.shortDescription = value; }
    public String getLocationDescription() { return locationDescription; }
    public void setLocationDescription(String value) { this.locationDescription = value; }

    public Long getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(Long categoryId) {
        this.categoryId = categoryId;
    }

    public String getCategoryName() {
        return categoryName;
    }

    public void setCategoryName(String categoryName) {
        this.categoryName = categoryName;
    }

    public BigDecimal getLongitude() {
        return longitude;
    }

    public void setLongitude(BigDecimal longitude) {
        this.longitude = longitude;
    }

    public BigDecimal getLatitude() {
        return latitude;
    }

    public void setLatitude(BigDecimal latitude) {
        this.latitude = latitude;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public List<String> getGalleryImages() {
        return galleryImages;
    }

    public void setGalleryImages(List<String> galleryImages) {
        this.galleryImages = galleryImages;
    }

    public LocalTime getOpenTime() {
        return openTime;
    }

    public void setOpenTime(LocalTime openTime) {
        this.openTime = openTime;
    }

    public LocalTime getCloseTime() {
        return closeTime;
    }

    public void setCloseTime(LocalTime closeTime) {
        this.closeTime = closeTime;
    }

    public Boolean getMapVisible() { return mapVisible; }
    public void setMapVisible(Boolean value) { this.mapVisible = value; }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
