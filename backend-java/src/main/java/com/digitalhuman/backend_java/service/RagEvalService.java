package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.RagEvalCaseDto;
import com.digitalhuman.backend_java.dto.RagEvalRunDto;
import com.digitalhuman.backend_java.model.RagEvalCaseResult;
import com.digitalhuman.backend_java.model.RagEvalRun;
import com.digitalhuman.backend_java.repository.RagEvalCaseResultRepository;
import com.digitalhuman.backend_java.repository.RagEvalRunRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class RagEvalService {
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final List<EvalCase> CASES = List.of(
            new EvalCase("spot_intro_lingshan", "灵山大佛有什么特色？", List.of("灵山大佛")),
            new EvalCase("route_family", "带孩子去灵山胜境怎么安排？", List.of("亲子")),
            new EvalCase("unknown_coverage", "景区附近明天几点有无人机表演？", List.of("知识库暂未覆盖"))
    );

    @Value("${rag.service-url}")
    private String ragServiceUrl;

    private final RagEvalRunRepository runRepository;
    private final RagEvalCaseResultRepository caseRepository;
    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;

    public RagEvalService(RagEvalRunRepository runRepository, RagEvalCaseResultRepository caseRepository, ObjectMapper objectMapper) {
        this.runRepository = runRepository;
        this.caseRepository = caseRepository;
        this.objectMapper = objectMapper;
        this.httpClient = new OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(180, TimeUnit.SECONDS).build();
    }

    public List<RagEvalRunDto> listRuns() {
        return runRepository.findTop50ByOrderByCreatedAtDesc().stream()
                .map(run -> toRunDto(run, List.of()))
                .toList();
    }

    public RagEvalRunDto getRun(Long id) {
        RagEvalRun run = runRepository.findById(id).orElseThrow();
        return toRunDto(run, caseRepository.findByRunIdOrderByCaseIdAsc(id).stream().map(this::toCaseDto).toList());
    }

    public RagEvalRunDto runEval() {
        RagEvalRun run = new RagEvalRun();
        run.setPromptVersion("unknown");
        run.setTotalCases(CASES.size());
        run.setPassedCases(0);
        run.setPassRate(0);
        run.setCreatedAt(LocalDateTime.now());
        runRepository.save(run);

        int passed = 0;
        String promptVersion = "unknown";
        for (EvalCase evalCase : CASES) {
            RagEvalCaseResult result = callCase(run.getId(), evalCase);
            if (result.isPassed()) {
                passed++;
            }
            if (result.getPromptVersion() != null) {
                promptVersion = result.getPromptVersion();
            }
            caseRepository.save(result);
        }
        run.setPromptVersion(promptVersion);
        run.setPassedCases(passed);
        run.setPassRate(CASES.isEmpty() ? 0 : Math.round(passed * 10000.0 / CASES.size()) / 100.0);
        runRepository.save(run);
        return getRun(run.getId());
    }

    private RagEvalCaseResult callCase(Long runId, EvalCase evalCase) {
        RagEvalCaseResult result = new RagEvalCaseResult();
        result.setRunId(runId);
        result.setCaseId(evalCase.id());
        result.setQuestion(evalCase.question());
        try {
            String traceId = "eval-" + evalCase.id() + "-" + UUID.randomUUID();
            String payload = objectMapper.writeValueAsString(new RagEvalRequest(evalCase.question(), 5, "eval-" + evalCase.id(), traceId));
            Request request = new Request.Builder().url(ragServiceUrl + "/rag/query").post(RequestBody.create(payload, JSON)).build();
            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    throw new IllegalStateException("RAG eval request failed: " + response.code());
                }
                JsonNode data = objectMapper.readTree(response.body().string());
                String answer = data.path("answer").asText("");
                List<String> missing = evalCase.keywords().stream().filter(keyword -> !answer.contains(keyword)).toList();
                result.setPassed(missing.isEmpty());
                result.setFailureReason(missing.isEmpty() ? null : "缺少关键词：" + String.join("、", missing));
                result.setTraceId(data.path("traceId").asText(traceId));
                result.setPromptVersion(data.path("promptVersion").asText(null));
                result.setRetrievedChunks(data.path("chunks").size());
                result.setTopScore(data.path("chunks").isArray() && data.path("chunks").size() > 0 ? data.path("chunks").get(0).path("score").asDouble() : null);
                result.setCitationsValid(data.path("citationsValid").asBoolean());
                result.setLowConfidence(data.path("lowConfidence").asBoolean());
                result.setAnswerPreview(answer.length() > 500 ? answer.substring(0, 500) : answer);
            }
        } catch (Exception exception) {
            result.setPassed(false);
            result.setFailureReason(exception.getMessage());
        }
        return result;
    }

    private RagEvalRunDto toRunDto(RagEvalRun run, List<RagEvalCaseDto> cases) {
        return new RagEvalRunDto(run.getId(), run.getPromptVersion(), run.getTotalCases(), run.getPassedCases(), run.getPassRate(), run.getCreatedAt(), cases);
    }

    private RagEvalCaseDto toCaseDto(RagEvalCaseResult result) {
        return new RagEvalCaseDto(result.getCaseId(), result.getQuestion(), result.isPassed(), result.getFailureReason(), result.getTraceId(), result.getPromptVersion(), result.getTopScore(), result.getRetrievedChunks(), result.getCitationsValid(), result.getLowConfidence(), result.getAnswerPreview());
    }

    private record EvalCase(String id, String question, List<String> keywords) {}
    private record RagEvalRequest(String question, Integer topK, String sessionId, String traceId) {}
}
