package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.ScenicRouteDto;
import com.digitalhuman.backend_java.dto.ScenicSpotDto;
import com.digitalhuman.backend_java.service.GuideService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/scenic")
public class ScenicController {

    private final GuideService guideService;

    public ScenicController(GuideService guideService) {
        this.guideService = guideService;
    }

    @GetMapping("/spots")
    public List<ScenicSpotDto> getSpots() {
        return guideService.getAllSpots();
    }

    @GetMapping("/routes/recommend")
    public List<ScenicRouteDto> recommendRoutes(@RequestParam(required = false) String interest) {
        return guideService.recommendRoutes(interest);
    }
}
