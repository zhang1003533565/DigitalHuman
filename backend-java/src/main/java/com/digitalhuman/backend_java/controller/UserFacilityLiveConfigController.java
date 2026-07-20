package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.VisitorFacilityLiveConfigDto;
import com.digitalhuman.backend_java.service.ScenicFacilityContentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user/live")
public class UserFacilityLiveConfigController {
    private final ScenicFacilityContentService service;

    public UserFacilityLiveConfigController(ScenicFacilityContentService service) {
        this.service = service;
    }

    @GetMapping("/config")
    public VisitorFacilityLiveConfigDto config(@RequestParam Long facilityId) {
        return service.getVisitorLiveConfig(facilityId);
    }
}
