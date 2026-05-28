package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.model.HomeConfig;
import com.digitalhuman.backend_java.model.HomeConfigType;
import com.digitalhuman.backend_java.service.HomeConfigService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/home")
public class UserHomeController {

    private final HomeConfigService homeConfigService;

    public UserHomeController(HomeConfigService homeConfigService) {
        this.homeConfigService = homeConfigService;
    }

    @GetMapping
    public Map<String, List<HomeConfig>> getHomeData() {
        Map<String, List<HomeConfig>> result = new HashMap<>();
        result.put("banners", homeConfigService.listEnabledByType(HomeConfigType.BANNER));
        result.put("ads", homeConfigService.listEnabledByType(HomeConfigType.AD));
        result.put("spotRecommends", homeConfigService.listEnabledByType(HomeConfigType.SPOT_RECOMMEND));
        result.put("routeRecommends", homeConfigService.listEnabledByType(HomeConfigType.ROUTE_RECOMMEND));
        return result;
    }

    @GetMapping("/by-type")
    public List<HomeConfig> getByType(@RequestParam HomeConfigType type) {
        return homeConfigService.listEnabledByType(type);
    }
}
