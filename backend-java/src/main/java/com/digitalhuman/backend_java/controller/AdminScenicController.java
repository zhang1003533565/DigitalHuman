package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.ScenicRouteDto;
import com.digitalhuman.backend_java.dto.ScenicRouteSaveRequest;
import com.digitalhuman.backend_java.dto.ScenicSpotDto;
import com.digitalhuman.backend_java.service.GuideService;
import com.digitalhuman.backend_java.service.ScenicRouteService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/scenic")
public class AdminScenicController {

    private final GuideService guideService;
    private final ScenicRouteService scenicRouteService;

    public AdminScenicController(GuideService guideService, ScenicRouteService scenicRouteService) {
        this.guideService = guideService;
        this.scenicRouteService = scenicRouteService;
    }

    @GetMapping("/spots")
    public List<ScenicSpotDto> getSpots() {
        return guideService.getAllSpots();
    }

    @GetMapping("/routes")
    public List<ScenicRouteDto> getRoutes(@RequestParam(required = false) String interest) {
        if (interest == null || interest.isBlank()) {
            return scenicRouteService.getAllRoutes();
        }
        return scenicRouteService.recommendRoutes(interest);
    }

    @PostMapping("/routes")
    public ScenicRouteDto createRoute(@RequestBody ScenicRouteSaveRequest request) {
        return scenicRouteService.saveRoute(request);
    }

    @PutMapping("/routes/{id}")
    public ScenicRouteDto updateRoute(@PathVariable String id, @RequestBody ScenicRouteSaveRequest request) {
        request.setId(id);
        return scenicRouteService.saveRoute(request);
    }

    @DeleteMapping("/routes/{id}")
    public void deleteRoute(@PathVariable String id) {
        scenicRouteService.deleteRoute(id);
    }
}
