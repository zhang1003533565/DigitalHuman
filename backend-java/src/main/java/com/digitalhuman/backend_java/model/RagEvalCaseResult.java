package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "rag_eval_case_result")
public class RagEvalCaseResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long runId;

    @Column(nullable = false, length = 80)
    private String caseId;

    @Column(nullable = false, length = 500)
    private String question;

    @Column(nullable = false)
    private boolean passed;

    @Column(length = 1000)
    private String failureReason;

    @Column(length = 80)
    private String traceId;

    @Column(length = 80)
    private String promptVersion;

    private Double topScore;
    private Integer retrievedChunks;
    private Boolean citationsValid;
    private Boolean lowConfidence;

    @Lob
    private String answerPreview;

    public void setRunId(Long runId) { this.runId = runId; }
    public void setCaseId(String caseId) { this.caseId = caseId; }
    public void setQuestion(String question) { this.question = question; }
    public void setPassed(boolean passed) { this.passed = passed; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
    public void setTraceId(String traceId) { this.traceId = traceId; }
    public void setPromptVersion(String promptVersion) { this.promptVersion = promptVersion; }
    public void setTopScore(Double topScore) { this.topScore = topScore; }
    public void setRetrievedChunks(Integer retrievedChunks) { this.retrievedChunks = retrievedChunks; }
    public void setCitationsValid(Boolean citationsValid) { this.citationsValid = citationsValid; }
    public void setLowConfidence(Boolean lowConfidence) { this.lowConfidence = lowConfidence; }
    public void setAnswerPreview(String answerPreview) { this.answerPreview = answerPreview; }
    public Long getRunId() { return runId; }
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
