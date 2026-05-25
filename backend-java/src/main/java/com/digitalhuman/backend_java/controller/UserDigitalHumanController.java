package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.ActionMatchRequest;
import com.digitalhuman.backend_java.dto.ActionMatchResponse;
import com.digitalhuman.backend_java.service.ModelEmotionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user/digital-human")
public class UserDigitalHumanController {

    private final ModelEmotionService modelEmotionService;

    public UserDigitalHumanController(ModelEmotionService modelEmotionService) {
        this.modelEmotionService = modelEmotionService;
    }

    @GetMapping("/models")
    public List<Map<String, Object>> getModels() {
        return modelEmotionService.getUserModelConfigs();
    }

    @PostMapping("/action-match")
    public ActionMatchResponse matchAction(@RequestBody ActionMatchRequest request) {
        return modelEmotionService.matchAction(request);
    }
}
