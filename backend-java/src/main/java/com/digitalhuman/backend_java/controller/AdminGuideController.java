package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.FeedbackRecordDto;
import com.digitalhuman.backend_java.dto.GuideMessageDto;
import com.digitalhuman.backend_java.dto.RagTraceDetailDto;
import com.digitalhuman.backend_java.dto.RagTraceSummaryDto;
import com.digitalhuman.backend_java.service.GuideService;
import com.digitalhuman.backend_java.service.RagTraceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/guide")
public class AdminGuideController {

    private final GuideService guideService;
    private final RagTraceService ragTraceService;

    public AdminGuideController(GuideService guideService, RagTraceService ragTraceService) {
        this.guideService = guideService;
        this.ragTraceService = ragTraceService;
    }

    @GetMapping("/session/{id}/messages")
    public List<GuideMessageDto> getSessionMessages(@PathVariable("id") String sessionId) {
        return guideService.getSessionMessages(sessionId);
    }

    @GetMapping("/feedback")
    public List<FeedbackRecordDto> getFeedbackRecords() {
        return guideService.getFeedbackRecords();
    }

    @GetMapping("/rag-traces")
    public List<RagTraceSummaryDto> getRagTraces(
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "status", required = false, defaultValue = "all") String status) {
        return ragTraceService.search(keyword, status);
    }

    @GetMapping("/rag-traces/{traceId}")
    public RagTraceDetailDto getRagTrace(@PathVariable String traceId) {
        return ragTraceService.getDetail(traceId);
    }
}
