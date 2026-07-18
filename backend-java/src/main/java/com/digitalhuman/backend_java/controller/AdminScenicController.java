package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.FacilityCategoryDto;
import com.digitalhuman.backend_java.dto.FacilityCategoryRequestDto;
import com.digitalhuman.backend_java.dto.ScenicFacilityDto;
import com.digitalhuman.backend_java.dto.ScenicFacilityContentRequest;
import com.digitalhuman.backend_java.dto.ScenicFacilityContentResponse;
import com.digitalhuman.backend_java.dto.ScenicFacilityRequestDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto;
import com.digitalhuman.backend_java.dto.ScenicRouteSaveRequest;
import com.digitalhuman.backend_java.dto.ScenicSpotDto;
import com.digitalhuman.backend_java.model.VoiceScriptScene;
import com.digitalhuman.backend_java.service.AdminScenicFacilityService;
import com.digitalhuman.backend_java.service.ScenicFacilityContentService;
import com.digitalhuman.backend_java.service.GuideService;
import com.digitalhuman.backend_java.service.ScenicRouteService;
import jakarta.validation.Valid;
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
    private final AdminScenicFacilityService adminScenicFacilityService;
    private final ScenicFacilityContentService scenicFacilityContentService;

    public AdminScenicController(
            GuideService guideService,
            ScenicRouteService scenicRouteService,
            AdminScenicFacilityService adminScenicFacilityService,
            ScenicFacilityContentService scenicFacilityContentService) {
        this.guideService = guideService;
        this.scenicRouteService = scenicRouteService;
        this.adminScenicFacilityService = adminScenicFacilityService;
        this.scenicFacilityContentService = scenicFacilityContentService;
    }

    @GetMapping("/spots")
    public List<ScenicSpotDto> getSpots() {
        return guideService.getAllSpots();
    }

    @GetMapping("/categories")
    public List<FacilityCategoryDto> getCategories() {
        return adminScenicFacilityService.getCategories();
    }

    @PostMapping("/categories")
    public FacilityCategoryDto createCategory(@Valid @RequestBody FacilityCategoryRequestDto request) {
        return adminScenicFacilityService.createCategory(request);
    }

    @PutMapping("/categories/{id}")
    public FacilityCategoryDto updateCategory(
            @PathVariable Long id,
            @Valid @RequestBody FacilityCategoryRequestDto request) {
        return adminScenicFacilityService.updateCategory(id, request);
    }

    @DeleteMapping("/categories/{id}")
    public void deleteCategory(@PathVariable Long id) {
        adminScenicFacilityService.deleteCategory(id);
    }

    @GetMapping("/facilities")
    public List<ScenicFacilityDto> getFacilities() {
        return adminScenicFacilityService.getFacilities();
    }

    @GetMapping("/facilities/{id}")
    public ScenicFacilityDto getFacility(@PathVariable Long id) {
        return adminScenicFacilityService.getFacility(id);
    }

    @PostMapping("/facilities")
    public ScenicFacilityDto createFacility(@Valid @RequestBody ScenicFacilityRequestDto request) {
        return adminScenicFacilityService.createFacility(request);
    }

    @PutMapping("/facilities/{id}")
    public ScenicFacilityDto updateFacility(
            @PathVariable Long id,
            @Valid @RequestBody ScenicFacilityRequestDto request) {
        return adminScenicFacilityService.updateFacility(id, request);
    }

    @DeleteMapping("/facilities/{id}")
    public void deleteFacility(@PathVariable Long id) {
        adminScenicFacilityService.deleteFacility(id);
    }

    @GetMapping("/facilities/{id}/content")
    public ScenicFacilityContentResponse getFacilityContent(@PathVariable Long id) {
        return scenicFacilityContentService.getContent(id);
    }

    @PutMapping("/facilities/{id}/content")
    public ScenicFacilityContentResponse saveFacilityContent(
            @PathVariable Long id,
            @RequestBody ScenicFacilityContentRequest request) {
        return scenicFacilityContentService.saveContent(id, request);
    }

    @GetMapping("/facilities/{id}/voice-scripts")
    public List<VoiceScriptScene> getBindableVoiceScripts(@PathVariable Long id) {
        return scenicFacilityContentService.listVoiceScriptsForManagement(id);
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
