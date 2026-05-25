package com.digitalhuman.backend_java.dto;

public class RagEvalCaseDto {
    private final String caseId;
    private final String question;
    private final boolean passed;
    private final String failureReason;
    private final String traceId;
    private final String promptVersion;
    private final Double topScore;
    private final Integer retrievedChunks;
    private final Boolean citationsValid;
    private final Boolean lowConfidence;
    private final String answerPreview;

    public RagEvalCaseDto(String caseId, String question, boolean passed, String failureReason, String traceId, String promptVersion, Double topScore, Integer retrievedChunks, Boolean citationsValid, Boolean lowConfidence, String answerPreview) {
        this.caseId = caseId;
        this.question = question;
        this.passed = passed;
        this.failureReason = failureReason;
        this.traceId = traceId;
        this.promptVersion = promptVersion;
        this.topScore = topScore;
        this.retrievedChunks = retrievedChunks;
        this.citationsValid = citationsValid;
        this.lowConfidence = lowConfidence;
        this.answerPreview = answerPreview;
    }

    public String getCaseId() { return caseId; }
    public String getQuestion() { return question; }
    public boolean isPassed() { return passed; }
    public String getFailureReason() { return failureReason; }
    public String getTraceId() { return traceId; }
    public String getPromptVersion() { return promptVersion; }
    public Double getTopScore() { return topScore; }
    public Integer getRetrievedChunks() { return retrievedChunks; }
    public Boolean getCitationsValid() { return citationsValid; }
    public Boolean getLowConfidence() { return lowConfidence; }
    public String getAnswerPreview() { return answerPreview; }
}
