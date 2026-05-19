package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.FeedbackRequest;
import com.digitalhuman.backend_java.dto.FeedbackResponse;
import com.digitalhuman.backend_java.dto.GuideChatRequest;
import com.digitalhuman.backend_java.dto.GuideChatResponse;
import com.digitalhuman.backend_java.dto.GuideMessageDto;
import com.digitalhuman.backend_java.service.GuideService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/user/guide")
public class UserGuideController {

    private final GuideService guideService;

    public UserGuideController(GuideService guideService) {
        this.guideService = guideService;
    }

    @PostMapping("/chat")
    public GuideChatResponse chat(@Valid @RequestBody GuideChatRequest request) {
        return guideService.chat(request);
    }

    @GetMapping("/session/{id}/messages")
    public List<GuideMessageDto> getSessionMessages(@PathVariable("id") String sessionId) {
        return guideService.getSessionMessages(sessionId);
    }

    @PostMapping("/feedback")
    public FeedbackResponse saveFeedback(@Valid @RequestBody FeedbackRequest request) {
        guideService.saveFeedback(request);
        return new FeedbackResponse(true, "反馈已提交");
    }
}
