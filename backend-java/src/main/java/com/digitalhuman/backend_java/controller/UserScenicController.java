package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.FacilityCategoryDto;
import com.digitalhuman.backend_java.dto.ScenicFacilityDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto;
import com.digitalhuman.backend_java.dto.ScenicSpotDto;
import com.digitalhuman.backend_java.dto.TripPlanRequest;
import com.digitalhuman.backend_java.dto.TripPlanResponse;
import com.digitalhuman.backend_java.service.AdminScenicFacilityService;
import com.digitalhuman.backend_java.service.GuideService;
import com.digitalhuman.backend_java.service.ScenicRouteService;
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

    public UserScenicController(
            GuideService guideService,
            ScenicRouteService scenicRouteService,
            AdminScenicFacilityService adminScenicFacilityService) {
        this.guideService = guideService;
        this.scenicRouteService = scenicRouteService;
        this.adminScenicFacilityService = adminScenicFacilityService;
    }

    @GetMapping("/spots")
    public List<ScenicSpotDto> getSpots() {
        return guideService.getAllSpots();
    }

    @GetMapping("/facilities")
    public List<ScenicFacilityDto> getFacilities() {
        return adminScenicFacilityService.getFacilities();
    }

    @GetMapping("/categories")
    public List<FacilityCategoryDto> getCategories() {
        return adminScenicFacilityService.getCategories();
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
