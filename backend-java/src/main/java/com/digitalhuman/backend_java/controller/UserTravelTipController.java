package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.TravelTipDto;
import com.digitalhuman.backend_java.service.TravelTipService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/user/travel-tips")
public class UserTravelTipController {

    private final TravelTipService travelTipService;

    public UserTravelTipController(TravelTipService travelTipService) {
        this.travelTipService = travelTipService;
    }

    @GetMapping
    public List<TravelTipDto> getTips() {
        return travelTipService.getEnabledTips();
    }
}
