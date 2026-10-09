package com.digitalhuman.backend_java.dto;

public record ScenicSpotCardDto(
        Long id,
        String scenicName,
        String spotId,
        String spotName,
        String location,
        String coreFunction,
        String highlights,
        String detailedIntroduction) {
}
