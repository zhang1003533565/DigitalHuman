package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.FeedbackRecordDto;
import com.digitalhuman.backend_java.dto.GuideMessageDto;
import com.digitalhuman.backend_java.dto.RagTraceDetailDto;
import com.digitalhuman.backend_java.dto.RagTraceSummaryDto;
import com.digitalhuman.backend_java.dto.RagReviewActionRequest;
import com.digitalhuman.backend_java.dto.RagMetricsDto;
import com.digitalhuman.backend_java.dto.RagEvalRunDto;
import com.digitalhuman.backend_java.dto.RagPromptCompareDto;
import com.digitalhuman.backend_java.dto.RagPromptCompareRequest;
import com.digitalhuman.backend_java.service.GuideService;
import com.digitalhuman.backend_java.service.AdminSettingsService;
import com.digitalhuman.backend_java.service.RagEvalService;
import com.digitalhuman.backend_java.service.RagTraceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/guide")
public class AdminGuideController {

    private final GuideService guideService;
    private final RagTraceService ragTraceService;
    private final RagEvalService ragEvalService;
    private final AdminSettingsService adminSettingsService;

    public AdminGuideController(GuideService guideService, RagTraceService ragTraceService, RagEvalService ragEvalService, AdminSettingsService adminSettingsService) {
        this.guideService = guideService;
        this.ragTraceService = ragTraceService;
        this.ragEvalService = ragEvalService;
        this.adminSettingsService = adminSettingsService;
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

    @GetMapping("/rag-metrics")
    public RagMetricsDto getRagMetrics() {
        return ragTraceService.getMetrics();
    }

    @GetMapping("/rag-reviews")
    public List<RagTraceSummaryDto> getRagReviewQueue(@RequestParam(value = "status", required = false, defaultValue = "PENDING") String status) {
        return ragTraceService.listReviewQueue(status);
    }

    @GetMapping("/rag-review-stats")
    public Map<String, Object> getRagReviewStats() {
        return ragTraceService.reviewStats();
    }

    @PostMapping("/rag-reviews/{traceId}")
    public RagTraceDetailDto reviewRagTrace(@PathVariable String traceId, @RequestBody RagReviewActionRequest request) {
        return ragTraceService.review(traceId, request);
    }

    @GetMapping("/rag-evals")
    public List<RagEvalRunDto> listEvalRuns() {
        return ragEvalService.listRuns();
    }

    @GetMapping("/rag-evals/{id}")
    public RagEvalRunDto getEvalRun(@PathVariable Long id) {
        return ragEvalService.getRun(id);
    }

    @PostMapping("/rag-evals/run")
    public RagEvalRunDto runEval() {
        return ragEvalService.runEval();
    }

    @PostMapping("/rag-evals/compare-prompts")
    public RagPromptCompareDto comparePromptVersions(@RequestBody RagPromptCompareRequest request) {
        return ragEvalService.comparePromptVersions(request.getLeftVersion(), request.getRightVersion(), adminSettingsService);
    }
}
