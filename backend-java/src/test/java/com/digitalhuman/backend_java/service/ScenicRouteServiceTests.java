package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TripPlanRequest;
import com.digitalhuman.backend_java.dto.TripPlanResponse;
import com.digitalhuman.backend_java.model.ScenicRoute;
import com.digitalhuman.backend_java.repository.ScenicRouteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ScenicRouteServiceTests {

    private ScenicRouteRepository repository;
    private ScenicRouteService service;

    @BeforeEach
    void setUp() {
        repository = mock(ScenicRouteRepository.class);
        service = new ScenicRouteService(repository);
    }

    @Test
    void planTripFiltersByInterestDurationAndIntensity() {
        when(repository.findByEnabledTrueOrderBySortOrderAsc()).thenReturn(List.of(
                route("route-1", "历史文化", "6小时", "深度步行", "历史文化,首次来访"),
                route("route-3", "亲子家庭", "4小时", "轻松少走", "亲子家庭,family,少走路")));

        TripPlanRequest request = new TripPlanRequest("亲子家庭", 4, "轻松少走", "family");
        TripPlanResponse result = service.planTrip(request);

        assertEquals("route-3", result.route().getId());
        assertEquals(100, result.score());
        assertFalse(result.reminders().isEmpty());
        assertFalse(result.fallbackUsed());
    }

    @Test
    void planTripFallsBackToHighestScoringEnabledRoute() {
        when(repository.findByEnabledTrueOrderBySortOrderAsc()).thenReturn(List.of(
                route("route-1", "历史文化", "6小时", "深度步行", "首次来访"),
                route("route-2", "自然风光", "5小时", "舒缓步行", "拍照,朋友")));

        TripPlanResponse result = service.planTrip(new TripPlanRequest("自然风光", 3, "轻松少走", "family"));

        assertEquals("route-2", result.route().getId());
        assertEquals(40, result.score());
        assertTrue(result.fallbackUsed());
        assertFalse(result.reasons().isEmpty());
    }

    @Test
    void planTripReturnsEmptyResponseWhenNoRoutesAreEnabled() {
        when(repository.findByEnabledTrueOrderBySortOrderAsc()).thenReturn(List.of());

        TripPlanResponse result = service.planTrip(new TripPlanRequest("自然风光", 4, "舒缓步行", "friends"));

        assertNull(result.route());
        assertEquals(0, result.score());
        assertTrue(result.fallbackUsed());
        assertTrue(result.reminders().contains("暂无可用路线，请先在管理后台启用路线"));
    }

    @Test
    void planTripAwardsDurationPointsForNinetyMinutesWithinTwoHours() {
        when(repository.findByEnabledTrueOrderBySortOrderAsc()).thenReturn(List.of(
                route("route-minutes", "历史文化", "90分钟", "深度步行", "首次来访")));

        TripPlanResponse result = service.planTrip(new TripPlanRequest("自然风光", 2, "轻松少走", "family"));

        assertEquals(25, result.score());
    }

    @Test
    void planTripUsesDurationRangeUpperBound() {
        when(repository.findByEnabledTrueOrderBySortOrderAsc()).thenReturn(List.of(
                route("route-range", "历史文化", "约4-5小时", "深度步行", "首次来访")));

        TripPlanResponse fourHourResult = service.planTrip(new TripPlanRequest("自然风光", 4, "轻松少走", "family"));
        TripPlanResponse fiveHourResult = service.planTrip(new TripPlanRequest("自然风光", 5, "轻松少走", "family"));

        assertEquals(0, fourHourResult.score());
        assertEquals(25, fiveHourResult.score());
    }

    @Test
    void planTripDoesNotAwardDurationPointsWhenDurationCannotBeParsedReliably() {
        when(repository.findByEnabledTrueOrderBySortOrderAsc()).thenReturn(List.of(
                route("route-unknown", "历史文化", "半天", "深度步行", "首次来访")));

        TripPlanResponse result = service.planTrip(new TripPlanRequest("自然风光", 8, "轻松少走", "family"));

        assertEquals(0, result.score());
    }

    @Test
    void planTripAwardsExactlyTwentyPointsForIntensityMatch() {
        when(repository.findByEnabledTrueOrderBySortOrderAsc()).thenReturn(List.of(
                route("route-intensity", "历史文化", "6小时", "轻松少走", "首次来访")));

        TripPlanResponse result = service.planTrip(new TripPlanRequest("自然风光", 1, "轻松少走", "family"));

        assertEquals(20, result.score());
    }

    @Test
    void planTripAwardsExactlyFifteenPointsForCompanionMatch() {
        when(repository.findByEnabledTrueOrderBySortOrderAsc()).thenReturn(List.of(
                route("route-family", "历史文化", "6小时", "深度步行", "亲子家庭")));

        TripPlanResponse result = service.planTrip(new TripPlanRequest("自然风光", 1, "轻松少走", "family"));

        assertEquals(15, result.score());
    }

    private ScenicRoute route(String id, String suitableFor, String duration, String intensity, String tags) {
        ScenicRoute route = new ScenicRoute();
        route.setId(id);
        route.setName(id);
        route.setSuitableFor(suitableFor);
        route.setDuration(duration);
        route.setDistance("约2公里");
        route.setIntensity(intensity);
        route.setReason("推荐理由");
        route.setBestTime("上午");
        route.setTagsCsv(tags);
        route.setSortOrder(1);
        route.setEnabled(true);
        return route;
    }
}
