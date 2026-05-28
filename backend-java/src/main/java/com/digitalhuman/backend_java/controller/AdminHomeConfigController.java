package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.model.HomeConfig;
import com.digitalhuman.backend_java.model.HomeConfigType;
import com.digitalhuman.backend_java.service.HomeConfigService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/home-config")
public class AdminHomeConfigController {

    private final HomeConfigService homeConfigService;

    public AdminHomeConfigController(HomeConfigService homeConfigService) {
        this.homeConfigService = homeConfigService;
    }

    @GetMapping
    public List<HomeConfig> list(@RequestParam(required = false) HomeConfigType type) {
        if (type != null) {
            return homeConfigService.listByType(type);
        }
        return homeConfigService.listAll();
    }

    @PostMapping
    public HomeConfig create(@RequestBody HomeConfig config) {
        config.setId(null);
        return homeConfigService.save(config);
    }

    @PutMapping("/{id}")
    public HomeConfig update(@PathVariable String id, @RequestBody HomeConfig config) {
        config.setId(id);
        return homeConfigService.save(config);
    }

    @PatchMapping("/{id}/toggle")
    public HomeConfig toggle(@PathVariable String id, @RequestBody Map<String, Boolean> body) {
        boolean enabled = body.getOrDefault("enabled", true);
        return homeConfigService.toggleEnabled(id, enabled);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        homeConfigService.delete(id);
    }
}
