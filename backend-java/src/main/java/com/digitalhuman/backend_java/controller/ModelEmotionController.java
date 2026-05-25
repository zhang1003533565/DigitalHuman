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

    // ========== 模型接口 ==========

    /**
     * 获取所有模型列表
     */
    @GetMapping("/models")
    public ResponseEntity<List<?>> getModels() {
        return ResponseEntity.ok(modelEmotionService.getModels());
    }

    /**
     * 扫描模型目录
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
     * 获取模型详情
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
     * 更新模型启用的动作
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
     * 获取模型启用的动作
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

    // ========== 情感接口 ==========

    /**
     * 获取所有情感列表
     */
    @GetMapping("/emotions")
    public ResponseEntity<List<?>> getEmotions() {
        return ResponseEntity.ok(modelEmotionService.getEmotions());
    }

    /**
     * 创建情感
     */
    @PostMapping("/emotions")
    public ResponseEntity<?> createEmotion(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(modelEmotionService.createEmotion(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 更新情感
     */
    @PutMapping("/emotions/{id}")
    public ResponseEntity<?> updateEmotion(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(modelEmotionService.updateEmotion(id, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 删除情感
     */
    @DeleteMapping("/emotions/{id}")
    public ResponseEntity<?> deleteEmotion(@PathVariable Long id) {
        try {
            modelEmotionService.deleteEmotion(id);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ========== 模型情感接口 ==========

    /**
     * 获取模型支持的情感
     */
    @GetMapping("/models/{modelId}/emotions")
    public ResponseEntity<List<?>> getModelEmotions(@PathVariable Long modelId) {
        return ResponseEntity.ok(modelEmotionService.getModelEmotions(modelId));
    }

    /**
     * 添加模型支持的情感
     */
    @PostMapping("/models/{modelId}/emotions")
    public ResponseEntity<?> addModelEmotion(@PathVariable Long modelId, @RequestBody Map<String, Long> request) {
        try {
            Long emotionId = request.get("emotionId");
            return ResponseEntity.ok(modelEmotionService.addModelEmotion(modelId, emotionId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 移除模型支持的情感
     */
    @DeleteMapping("/models/{modelId}/emotions/{emotionId}")
    public ResponseEntity<?> removeModelEmotion(@PathVariable Long modelId, @PathVariable Long emotionId) {
        try {
            modelEmotionService.removeModelEmotion(modelId, emotionId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ========== 情感动作接口 ==========

    /**
     * 获取情感的动作
     */
    @GetMapping("/model-emotions/{id}/actions")
    public ResponseEntity<List<?>> getEmotionActions(@PathVariable Long id) {
        return ResponseEntity.ok(modelEmotionService.getModelEmotionActions(id));
    }

    /**
     * 添加情感动作
     */
    @PostMapping("/model-emotions/{id}/actions")
    public ResponseEntity<?> addEmotionAction(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        try {
            Long modelActionId = ((Number) request.get("modelActionId")).longValue();
            Integer priority = request.containsKey("priority") ? ((Number) request.get("priority")).intValue() : null;
            return ResponseEntity.ok(modelEmotionService.addModelEmotionAction(id, modelActionId, priority));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 移除情感动作
     */
    @DeleteMapping("/model-emotions/{id}/actions/{actionId}")
    public ResponseEntity<?> removeEmotionAction(@PathVariable Long id, @PathVariable Long actionId) {
        try {
            modelEmotionService.removeModelEmotionAction(actionId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
