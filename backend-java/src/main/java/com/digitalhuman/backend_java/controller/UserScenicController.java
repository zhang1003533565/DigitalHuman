package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.ScenicRouteDto;
import com.digitalhuman.backend_java.dto.ScenicSpotDto;
import com.digitalhuman.backend_java.service.GuideService;
import com.digitalhuman.backend_java.service.ScenicRouteService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/user/scenic")
public class UserScenicController {

    private final GuideService guideService;
    private final ScenicRouteService scenicRouteService;

    public UserScenicController(GuideService guideService, ScenicRouteService scenicRouteService) {
        this.guideService = guideService;
        this.scenicRouteService = scenicRouteService;
    }

    @GetMapping("/spots")
    public List<ScenicSpotDto> getSpots() {
        return guideService.getAllSpots();
    }

    @GetMapping("/routes/recommend")
    public List<ScenicRouteDto> recommendRoutes(@RequestParam(required = false) String interest) {
        return scenicRouteService.recommendRoutes(interest);
    }
}
