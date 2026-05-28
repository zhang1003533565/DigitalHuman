package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.ActionTriggerConfigDto;
import com.digitalhuman.backend_java.service.ModelEmotionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/model-emotion")
public class ModelEmotionController {

    private final ModelEmotionService modelEmotionService;

    public ModelEmotionController(ModelEmotionService modelEmotionService) {
        this.modelEmotionService = modelEmotionService;
    }

    // ========== 妯″瀷鎺ュ彛 ==========

    /**
     * 鑾峰彇鎵€鏈夋ā鍨嬪垪琛?
     */
    @GetMapping("/models")
    public ResponseEntity<List<?>> getModels() {
        return ResponseEntity.ok(modelEmotionService.getModels());
    }

    /**
     * 鎵弿妯″瀷鐩綍
     */
    @PostMapping("/models/scan")
    public ResponseEntity<?> scanModels() {
        try {
            return ResponseEntity.ok(modelEmotionService.scanModels());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 鑾峰彇妯″瀷璇︽儏
     */
    @GetMapping("/models/{id}")
    public ResponseEntity<?> getModelDetail(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(modelEmotionService.getModelDetail(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 鏇存柊妯″瀷鍚敤鐨勫姩浣?
     */
    @PutMapping("/models/{id}/actions")
    public ResponseEntity<?> updateModelActions(@PathVariable Long id, @RequestBody Map<String, List<Long>> request) {
        try {
            List<Long> enabledActionIds = request.get("enabledActionIds");
            return ResponseEntity.ok(modelEmotionService.updateModelActions(id, enabledActionIds));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 鑾峰彇妯″瀷鍚敤鐨勫姩浣?
     */
    @GetMapping("/models/{id}/actions")
    public ResponseEntity<?> getModelActions(@PathVariable Long id) {
        return ResponseEntity.ok(modelEmotionService.getModelEnabledActions(id));
    }

    @GetMapping("/models/{id}/trigger-config")
    public ResponseEntity<?> getTriggerConfig(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(modelEmotionService.getTriggerConfig(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/models/{id}/trigger-config")
    public ResponseEntity<?> saveTriggerConfig(@PathVariable Long id, @RequestBody ActionTriggerConfigDto request) {
        try {
            return ResponseEntity.ok(modelEmotionService.saveTriggerConfig(id, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
