package com.digitalhuman.backend_java.dto;

public record VisitorFacilityLiveConfigDto(
        Long facilityId,
        String facilityName,
        boolean available,
        String unavailableReason,
        String liveSourceType,
        String liveVideoUrl,
        String liveStreamUrl,
        DigitalHuman digitalHuman,
        Narration narration) {

    public record DigitalHuman(
            Long id,
            String modelKey,
            String displayName,
            String modelPath) {
    }

    public record Narration(
            Long scriptId,
            String title,
            String audioUrl,
            Integer durationSec,
            Integer versionNo) {
    }
}
