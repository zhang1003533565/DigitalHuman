package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.FacilityCategoryDto;
import com.digitalhuman.backend_java.dto.ScenicFacilityDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto;
import com.digitalhuman.backend_java.dto.ScenicSpotCardDto;
import com.digitalhuman.backend_java.dto.ScenicSpotDto;
import com.digitalhuman.backend_java.dto.TripPlanRequest;
import com.digitalhuman.backend_java.dto.TripPlanResponse;
import com.digitalhuman.backend_java.service.AdminScenicFacilityService;
import com.digitalhuman.backend_java.service.GuideService;
import com.digitalhuman.backend_java.service.ScenicRouteService;
import com.digitalhuman.backend_java.service.ScenicStructuredSpotService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/user/scenic")
public class UserScenicController {

    private final GuideService guideService;
    private final ScenicRouteService scenicRouteService;
    private final AdminScenicFacilityService adminScenicFacilityService;
    private final ScenicStructuredSpotService scenicStructuredSpotService;

    public UserScenicController(
            GuideService guideService,
            ScenicRouteService scenicRouteService,
            AdminScenicFacilityService adminScenicFacilityService,
            ScenicStructuredSpotService scenicStructuredSpotService) {
        this.guideService = guideService;
        this.scenicRouteService = scenicRouteService;
        this.adminScenicFacilityService = adminScenicFacilityService;
        this.scenicStructuredSpotService = scenicStructuredSpotService;
    }

    @GetMapping("/spots")
    public List<ScenicSpotDto> getSpots() {
        return guideService.getAllSpots();
    }

    @GetMapping("/spot-cards")
    public List<ScenicSpotCardDto> getSpotCards() {
        return scenicStructuredSpotService.listAll().stream()
                .filter(record -> record.getSpot_name() != null && !record.getSpot_name().isBlank())
                .map(record -> new ScenicSpotCardDto(
                        record.getId(),
                        record.getScenic_name(),
                        record.getSpot_id(),
                        record.getSpot_name(),
                        record.getLocation(),
                        record.getCore_function(),
                        record.getHighlights(),
                        record.getDetailed_introduction()))
                .toList();
    }

    @GetMapping("/facilities")
    public List<ScenicFacilityDto> getFacilities() {
        return adminScenicFacilityService.getMapVisibleFacilities();
    }

    @GetMapping("/categories")
    public List<FacilityCategoryDto> getCategories() {
        return adminScenicFacilityService.getMapVisibleCategories();
    }

    @GetMapping("/routes/recommend")
    public List<ScenicRouteDto> recommendRoutes(@RequestParam(required = false) String interest) {
        return scenicRouteService.recommendRoutes(interest);
    }

    @PostMapping("/trip-plan")
    public TripPlanResponse planTrip(@Valid @RequestBody TripPlanRequest request) {
        return scenicRouteService.planTrip(request);
    }
}
