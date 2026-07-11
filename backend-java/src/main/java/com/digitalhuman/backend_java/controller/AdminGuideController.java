package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.FeedbackRecordDto;
import com.digitalhuman.backend_java.dto.FeedbackUpdateRequest;
import com.digitalhuman.backend_java.dto.GuideChatRequest;
import com.digitalhuman.backend_java.dto.GuideChatResponse;
import com.digitalhuman.backend_java.dto.GuideMessageDto;
import com.digitalhuman.backend_java.service.GuideService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/guide")
public class AdminGuideController {

    private final GuideService guideService;

    public AdminGuideController(GuideService guideService) {
        this.guideService = guideService;
    }

    @GetMapping("/session/{id}/messages")
    public List<GuideMessageDto> getSessionMessages(@PathVariable("id") String sessionId) {
        return guideService.getSessionMessages(sessionId);
    }

    @PostMapping("/chat-test")
    public GuideChatResponse testGuideChat(@RequestBody GuideChatRequest request) {
        return guideService.chat(request);
    }

    @GetMapping("/feedback")
    public List<FeedbackRecordDto> getFeedbackRecords() {
        return guideService.getFeedbackRecords();
    }

    @PatchMapping("/feedback/{id}")
    public FeedbackRecordDto updateFeedback(@PathVariable("id") Long id,
                                            @RequestBody FeedbackUpdateRequest request) {
        return guideService.updateFeedback(id, request.status(), request.category(), request.adminNote());
    }
}
