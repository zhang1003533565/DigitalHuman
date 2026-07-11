package com.digitalhuman.backend_java.dto;

import java.util.List;

public record TripPlanResponse(
        ScenicRouteDto route,
        int score,
        List<String> reasons,
        List<String> reminders,
        boolean fallbackUsed) {

    public static TripPlanResponse empty(String reminder) {
        return new TripPlanResponse(null, 0, List.of(), List.of(reminder), true);
    }
}
