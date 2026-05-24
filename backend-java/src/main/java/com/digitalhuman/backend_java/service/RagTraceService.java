package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.GuideChatRequest;
import com.digitalhuman.backend_java.dto.RagQueryResponse;
import com.digitalhuman.backend_java.dto.RagTraceDetailDto;
import com.digitalhuman.backend_java.dto.RagTraceSummaryDto;
import com.digitalhuman.backend_java.model.RagTrace;
import com.digitalhuman.backend_java.repository.RagTraceRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RagTraceService {

    private final RagTraceRepository repository;
    private final ObjectMapper objectMapper;

    public RagTraceService(RagTraceRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
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
        trace.setLowConfidence(lowConfidence);
        trace.setNoAnswer(noAnswer);
        trace.setRetrievalAttempts(response.getRetrievalAttempts());
        trace.setTotalDurationMs(response.getTotalDurationMs());
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
                trace.getRetrievalAttempts(),
                trace.getTotalDurationMs(),
                trace.getCreatedAt());
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

    private record FailurePayload(String type, String message) {
    }
}
