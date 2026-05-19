package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.FeedbackRecordDto;
import com.digitalhuman.backend_java.dto.GuideMessageDto;
import com.digitalhuman.backend_java.service.GuideService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
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

    @GetMapping("/feedback")
    public List<FeedbackRecordDto> getFeedbackRecords() {
        return guideService.getFeedbackRecords();
    }
}
