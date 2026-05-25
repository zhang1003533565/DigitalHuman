package com.digitalhuman.backend_java.dto;

import java.time.LocalDateTime;
import java.util.List;

public class RagEvalRunDto {
    private final Long id;
    private final String promptVersion;
    private final int totalCases;
    private final int passedCases;
    private final double passRate;
    private final LocalDateTime createdAt;
    private final List<RagEvalCaseDto> cases;

    public RagEvalRunDto(Long id, String promptVersion, int totalCases, int passedCases, double passRate, LocalDateTime createdAt, List<RagEvalCaseDto> cases) {
        this.id = id;
        this.promptVersion = promptVersion;
        this.totalCases = totalCases;
        this.passedCases = passedCases;
        this.passRate = passRate;
        this.createdAt = createdAt;
        this.cases = cases;
    }

    public Long getId() { return id; }
    public String getPromptVersion() { return promptVersion; }
    public int getTotalCases() { return totalCases; }
    public int getPassedCases() { return passedCases; }
    public double getPassRate() { return passRate; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public List<RagEvalCaseDto> getCases() { return cases; }
}
