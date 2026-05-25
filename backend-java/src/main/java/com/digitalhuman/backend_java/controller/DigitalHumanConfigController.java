package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.DigitalHumanConfigDto;
import com.digitalhuman.backend_java.service.DigitalHumanConfigService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class DigitalHumanConfigController {
    private final DigitalHumanConfigService service;

    public DigitalHumanConfigController(DigitalHumanConfigService service) {
        this.service = service;
    }

    @GetMapping("/admin/settings/digital-human-config")
    public DigitalHumanConfigDto getAdminConfig() {
        return service.getConfig();
    }

    @PutMapping("/admin/settings/digital-human-config")
    public DigitalHumanConfigDto updateConfig(@RequestBody DigitalHumanConfigDto request) {
        return service.updateConfig(request);
    }

    @GetMapping("/user/digital-human/config")
    public DigitalHumanConfigDto getUserConfig() {
        return service.getConfig();
    }
}
