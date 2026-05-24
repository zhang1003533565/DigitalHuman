package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.GuideChatRequest;
import com.digitalhuman.backend_java.dto.RagQueryResponse;
import com.digitalhuman.backend_java.dto.RagMetricsDto;
import com.digitalhuman.backend_java.dto.RagReviewActionRequest;
import com.digitalhuman.backend_java.dto.RagTraceDetailDto;
import com.digitalhuman.backend_java.dto.RagTraceSummaryDto;
import com.digitalhuman.backend_java.model.RagTrace;
import com.digitalhuman.backend_java.repository.RagTraceRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RagTraceService {

    private final RagTraceRepository repository;
    private final ObjectMapper objectMapper;
    private final AuditLogService auditLogService;

    public RagTraceService(RagTraceRepository repository, ObjectMapper objectMapper, AuditLogService auditLogService) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.auditLogService = auditLogService;
    }

    public void saveSuccess(String traceId, String sessionId, GuideChatRequest request, RagQueryResponse response) {
        RagTrace trace = baseTrace(traceId, sessionId, request);
        String answer = response.getAnswer() == null ? "" : response.getAnswer();
        boolean noAnswer = answer.contains("知识库暂未覆盖") || answer.isBlank();
        boolean lowConfidence = Boolean.TRUE.equals(response.getLowConfidence())
                || Boolean.TRUE.equals(response.getReviewRequired())
                || Boolean.FALSE.equals(response.getContextSufficient())
                || Boolean.FALSE.equals(response.getQualityPassed())
                || noAnswer;

        trace.setStatus(noAnswer ? "NO_ANSWER" : lowConfidence ? "LOW_CONFIDENCE" : "SUCCESS");
        trace.setAnswerPreview(truncate(answer, 500));
        trace.setRewrittenQuestion(truncate(response.getRewrittenQuestion(), 500));
        trace.setReviewReason(truncate(response.getReviewReason(), 1000));
        trace.setLowConfidenceReason(truncate(response.getLowConfidenceReason(), 1000));
        trace.setContextSufficient(!Boolean.FALSE.equals(response.getContextSufficient()));
        trace.setQualityPassed(!Boolean.FALSE.equals(response.getQualityPassed()));
        trace.setCitationsValid(!Boolean.FALSE.equals(response.getCitationsValid()));
        trace.setReviewRequired(Boolean.TRUE.equals(response.getReviewRequired()));
        trace.setReviewStatus(Boolean.TRUE.equals(response.getReviewRequired()) ? "PENDING" : "NOT_REQUIRED");
        trace.setLowConfidence(lowConfidence);
        trace.setNoAnswer(noAnswer);
        trace.setRetrievalAttempts(response.getRetrievalAttempts());
        trace.setTotalDurationMs(response.getTotalDurationMs());
        trace.setPromptVersion(truncate(response.getPromptVersion(), 80));
        trace.setProviderStatus(truncate(response.getProviderStatus(), 50));
        trace.setProviderError(truncate(response.getProviderError(), 1000));
        trace.setRequestJson(writeJson(request));
        trace.setResponseJson(writeJson(response));
        repository.save(trace);
    }

    public void saveFailure(String traceId, String sessionId, GuideChatRequest request, Exception exception) {
        RagTrace trace = baseTrace(traceId, sessionId, request);
        trace.setStatus("FAILED");
        trace.setFailureReason(truncate(exception.getMessage(), 1000));
        trace.setContextSufficient(false);
        trace.setQualityPassed(false);
        trace.setCitationsValid(false);
        trace.setReviewRequired(false);
        trace.setReviewStatus("NOT_REQUIRED");
        trace.setLowConfidence(true);
        trace.setNoAnswer(true);
        trace.setRequestJson(writeJson(request));
        trace.setResponseJson(writeJson(new FailurePayload(exception.getClass().getSimpleName(), exception.getMessage())));
        repository.save(trace);
    }

    public List<RagTraceSummaryDto> search(String keyword, String status) {
        String normalizedKeyword = keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);
        String normalizedStatus = status == null ? "all" : status.trim();
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .filter(trace -> "all".equalsIgnoreCase(normalizedStatus) || normalizedStatus.isBlank() || trace.getStatus().equalsIgnoreCase(normalizedStatus))
                .filter(trace -> normalizedKeyword.isBlank()
                        || contains(trace.getTraceId(), normalizedKeyword)
                        || contains(trace.getSessionId(), normalizedKeyword)
                        || contains(trace.getQuestion(), normalizedKeyword)
                        || contains(trace.getAnswerPreview(), normalizedKeyword)
                        || contains(trace.getRewrittenQuestion(), normalizedKeyword))
                .limit(200)
                .map(this::toSummary)
                .toList();
    }

    public RagMetricsDto getMetrics() {
        List<RagTrace> traces = repository.findAllByOrderByCreatedAtDesc();
        long total = traces.size();
        long failed = traces.stream().filter(trace -> "FAILED".equalsIgnoreCase(trace.getStatus())).count();
        long lowConfidence = traces.stream().filter(RagTrace::isLowConfidence).count();
        long noAnswer = traces.stream().filter(RagTrace::isNoAnswer).count();
        long reviewRequired = traces.stream().filter(RagTrace::isReviewRequired).count();
        long negativeFeedback = traces.stream()
                .filter(trace -> Boolean.FALSE.equals(trace.getFeedbackHelpful()) || (trace.getFeedbackRating() != null && trace.getFeedbackRating() <= 2))
                .count();
        double averageDuration = traces.stream()
                .filter(trace -> trace.getTotalDurationMs() != null)
                .mapToDouble(RagTrace::getTotalDurationMs)
                .average()
                .orElse(0);
        List<RagTraceSummaryDto> slowTraces = traces.stream()
                .filter(trace -> trace.getTotalDurationMs() != null)
                .sorted(Comparator.comparing(RagTrace::getTotalDurationMs, Comparator.nullsLast(Double::compareTo)).reversed())
                .limit(20)
                .map(this::toSummary)
                .toList();
        List<RagTraceSummaryDto> anomalyTraces = traces.stream()
                .filter(trace -> trace.isLowConfidence() || trace.isNoAnswer() || "FAILED".equalsIgnoreCase(trace.getStatus()))
                .limit(20)
                .map(this::toSummary)
                .toList();
        return new RagMetricsDto(
                total,
                failed,
                lowConfidence,
                noAnswer,
                reviewRequired,
                negativeFeedback,
                round(averageDuration),
                rate(failed, total),
                rate(lowConfidence, total),
                rate(noAnswer, total),
                rate(reviewRequired, total),
                rate(negativeFeedback, total),
                slowTraces,
                anomalyTraces);
    }

    public RagTraceDetailDto getDetail(String traceId) {
        RagTrace trace = repository.findByTraceId(traceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "RAG trace 不存在"));
        return new RagTraceDetailDto(
                trace.getTraceId(),
                trace.getSessionId(),
                trace.getStatus(),
                trace.getQuestion(),
                trace.getInterest(),
                trace.getFailureReason(),
                trace.getReviewReason(),
                trace.getLowConfidenceReason(),
                trace.getReviewStatus(),
                trace.getReviewedAnswer(),
                trace.getReviewComment(),
                trace.getPromptVersion(),
                trace.getProviderStatus(),
                trace.getProviderError(),
                trace.getFeedbackHelpful(),
                trace.getFeedbackRating(),
                trace.getFeedbackComment(),
                trace.isContextSufficient(),
                trace.isQualityPassed(),
                trace.isCitationsValid(),
                trace.isReviewRequired(),
                trace.isLowConfidence(),
                trace.isNoAnswer(),
                trace.getRetrievalAttempts(),
                trace.getTotalDurationMs(),
                trace.getCreatedAt(),
                readJson(trace.getRequestJson()),
                readJson(trace.getResponseJson()));
    }

    public List<RagTraceSummaryDto> listReviewQueue(String status) {
        String normalizedStatus = status == null ? "PENDING" : status.trim();
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .filter(RagTrace::isReviewRequired)
                .filter(trace -> "all".equalsIgnoreCase(normalizedStatus) || normalizedStatus.isBlank() || normalizedStatus.equalsIgnoreCase(trace.getReviewStatus()))
                .limit(200)
                .map(this::toSummary)
                .toList();
    }

    public RagTraceDetailDto review(String traceId, RagReviewActionRequest request) {
        RagTrace trace = repository.findByTraceId(traceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "RAG trace 不存在"));
        String action = request.getAction() == null ? "" : request.getAction().trim().toUpperCase(Locale.ROOT);
        if (!List.of("APPROVED", "REWRITTEN", "REJECTED", "KNOWLEDGE_MISSING").contains(action)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "审核动作不合法");
        }
        trace.setReviewStatus(action);
        trace.setReviewedAnswer(truncate(request.getReviewedAnswer(), 2000));
        trace.setReviewComment(truncate(request.getComment(), 1000));
        repository.save(trace);
        auditLogService.record("admin", "RAG_REVIEW_" + action, "rag_trace", traceId, request);
        return getDetail(traceId);
    }

    public void attachFeedback(String traceId, boolean helpful, int rating, String comment) {
        if (traceId == null || traceId.isBlank()) {
            return;
        }
        repository.findByTraceId(traceId).ifPresent(trace -> {
            trace.setFeedbackHelpful(helpful);
            trace.setFeedbackRating(rating);
            trace.setFeedbackComment(truncate(comment, 1000));
            if (!helpful || rating <= 2) {
                trace.setLowConfidence(true);
                trace.setStatus("LOW_CONFIDENCE");
                trace.setLowConfidenceReason(appendReason(trace.getLowConfidenceReason(), "用户差评或低评分"));
            }
            repository.save(trace);
        });
    }

    private RagTrace baseTrace(String traceId, String sessionId, GuideChatRequest request) {
        RagTrace trace = new RagTrace();
        trace.setTraceId(traceId);
        trace.setSessionId(sessionId);
        trace.setQuestion(truncate(request.getQuestion(), 500));
        trace.setInterest(truncate(request.getInterest(), 200));
        trace.setCreatedAt(LocalDateTime.now());
        return trace;
    }

    private RagTraceSummaryDto toSummary(RagTrace trace) {
        return new RagTraceSummaryDto(
                trace.getTraceId(),
                trace.getSessionId(),
                trace.getStatus(),
                trace.getQuestion(),
                trace.getAnswerPreview(),
                trace.getRewrittenQuestion(),
                trace.isReviewRequired(),
                trace.isLowConfidence(),
                trace.isNoAnswer(),
                trace.getReviewStatus(),
                trace.getPromptVersion(),
                trace.getProviderStatus(),
                trace.getRetrievalAttempts(),
                trace.getTotalDurationMs(),
                trace.getCreatedAt());
    }

    private double rate(long value, long total) {
        if (total == 0) {
            return 0;
        }
        return round(value * 100.0 / total);
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            return "{}";
        }
    }

    private JsonNode readJson(String value) {
        try {
            return objectMapper.readTree(value == null || value.isBlank() ? "{}" : value);
        } catch (Exception exception) {
            return objectMapper.createObjectNode();
        }
    }

    private static boolean contains(String value, String keyword) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(keyword);
    }

    private static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private static String appendReason(String current, String reason) {
        if (current == null || current.isBlank()) {
            return reason;
        }
        if (current.contains(reason)) {
            return current;
        }
        return current + "；" + reason;
    }

    private record FailurePayload(String type, String message) {
    }
}
