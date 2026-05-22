package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.AdminModelSettingsDto;
import com.digitalhuman.backend_java.dto.AdminModelCatalogDto;
import com.digitalhuman.backend_java.dto.AdminModelOptionDto;
import com.digitalhuman.backend_java.dto.AdminProviderConfigDto;
import com.digitalhuman.backend_java.dto.AdminSyncModelsRequestDto;
import com.digitalhuman.backend_java.dto.AdminSyncModelsResponseDto;
import java.util.List;
import com.digitalhuman.backend_java.service.AdminSettingsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/settings")
public class AdminSettingsController {

    private final AdminSettingsService adminSettingsService;

    public AdminSettingsController(AdminSettingsService adminSettingsService) {
        this.adminSettingsService = adminSettingsService;
    }

    @GetMapping("/models")
    public AdminModelSettingsDto getModelSettings() {
        return adminSettingsService.getModelSettings();
    }

    @GetMapping("/model-options")
    public AdminModelCatalogDto getModelCatalog() {
        return adminSettingsService.getModelCatalog();
    }

    @PutMapping("/models")
    public AdminModelSettingsDto updateModelSettings(@RequestBody AdminModelSettingsDto request) {
        return adminSettingsService.updateModelSettings(request);
    }

    @PostMapping("/model-options")
    public AdminModelCatalogDto addModelOption(@RequestBody AdminModelOptionDto request) {
        return adminSettingsService.addModelOption(request);
    }

    @GetMapping("/provider-configs")
    public List<AdminProviderConfigDto> getProviderConfigs() {
        return adminSettingsService.getProviderConfigs();
    }

    @PutMapping("/provider-configs")
    public AdminProviderConfigDto saveProviderConfig(@RequestBody AdminProviderConfigDto request) {
        return adminSettingsService.saveProviderConfig(request);
    }

    @PostMapping("/provider-models/sync")
    public AdminSyncModelsResponseDto syncProviderModels(@RequestBody AdminSyncModelsRequestDto request) {
        return adminSettingsService.syncProviderModels(request);
    }
}
