package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record VisitorLiveStatusDto(
        String status,
        Instant serverTime,
        Long versionId,
        Instant publishedAt,
        Long totalDurationMs,
        Long currentItemId,
        Integer currentItemIndex,
        Long currentItemOffsetMs,
        Long cycleOffsetMs,
        List<LiveScriptItemDto> items
) {
    public static VisitorLiveStatusDto notPublished(Instant serverTime) {
        return new VisitorLiveStatusDto("notPublished", serverTime, null, null, null, null, null, null, null, null);
    }
}
