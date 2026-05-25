package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.AdminModelSettingsDto;
import com.digitalhuman.backend_java.dto.AdminModelCatalogDto;
import com.digitalhuman.backend_java.dto.AdminModelOptionDto;
import com.digitalhuman.backend_java.dto.AdminProviderDocDto;
import com.digitalhuman.backend_java.dto.AdminProviderConfigDto;
import com.digitalhuman.backend_java.dto.AdminModelTestRequestDto;
import com.digitalhuman.backend_java.dto.AdminModelTestResponseDto;
import com.digitalhuman.backend_java.dto.RagPromptConfigDto;
import com.digitalhuman.backend_java.dto.RagRetrievalConfigDto;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import com.digitalhuman.backend_java.service.AdminSettingsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    @PutMapping("/model-options/select")
    public AdminModelSettingsDto selectModelOption(@RequestBody AdminModelOptionDto request) {
        return adminSettingsService.selectModelOption(request);
    }

    @PostMapping("/model-options/delete")
    public AdminModelCatalogDto removeModelOption(@RequestBody AdminModelOptionDto request) {
        return adminSettingsService.removeModelOption(request);
    }

    @PostMapping("/model-test")
    public AdminModelTestResponseDto testModel(@RequestBody AdminModelTestRequestDto request) {
        return adminSettingsService.testModel(request);
    }

    @GetMapping("/providers")
    public List<AdminProviderConfigDto> getProviderConfigs() {
        return adminSettingsService.getProviderConfigs();
    }

    @PutMapping("/providers")
    public AdminProviderConfigDto saveProviderConfig(@RequestBody AdminProviderConfigDto request) {
        return adminSettingsService.saveProviderConfig(request);
    }

    @PostMapping("/providers/delete")
    public void deleteProviderConfig(@RequestBody AdminProviderConfigDto request) {
        adminSettingsService.deleteProviderConfig(request);
    }

    @GetMapping("/provider-docs/{provider}")
    public AdminProviderDocDto getProviderDoc(@PathVariable String provider) {
        return adminSettingsService.getProviderDoc(provider);
    }

    @GetMapping("/rag-prompt")
    public RagPromptConfigDto getRagPrompt() {
        return adminSettingsService.getRagPrompt();
    }

    @PutMapping("/rag-prompt")
    public RagPromptConfigDto updateRagPrompt(@RequestBody RagPromptConfigDto request) {
        return adminSettingsService.updateRagPrompt(request);
    }

    @GetMapping("/rag-prompts")
    public List<RagPromptConfigDto> listRagPrompts() {
        return adminSettingsService.listRagPrompts();
    }

    @PostMapping("/rag-prompts/{version}/publish")
    public RagPromptConfigDto publishRagPrompt(@PathVariable String version) {
        return adminSettingsService.publishRagPrompt(version);
    }

    @GetMapping("/rag-retrieval-config")
    public RagRetrievalConfigDto getRagRetrievalConfig() {
        return adminSettingsService.getRagRetrievalConfig();
    }

    @PutMapping("/rag-retrieval-config")
    public RagRetrievalConfigDto updateRagRetrievalConfig(@RequestBody RagRetrievalConfigDto request) {
        return adminSettingsService.updateRagRetrievalConfig(request);
    }

    @GetMapping("/ai-health")
    public JsonNode getAiServiceHealth() {
        return adminSettingsService.getAiServiceHealth();
    }
}
