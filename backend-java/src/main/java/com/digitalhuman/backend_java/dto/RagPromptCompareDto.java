package com.digitalhuman.backend_java.dto;

public record RagPromptCompareDto(
        RagEvalRunDto left,
        RagEvalRunDto right,
        double passRateDelta,
        int passedCasesDelta) {
}
