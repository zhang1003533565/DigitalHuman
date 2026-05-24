package com.digitalhuman.backend_java.dto;

import java.util.List;

public class RagMetricsDto {

    private final long totalTraces;
    private final long failedTraces;
    private final long lowConfidenceTraces;
    private final long noAnswerTraces;
    private final long reviewRequiredTraces;
    private final long negativeFeedbackTraces;
    private final double averageDurationMs;
    private final double providerFailureRate;
    private final double lowConfidenceRate;
    private final double noAnswerRate;
    private final double reviewTriggerRate;
    private final double negativeFeedbackRate;
    private final List<RagTraceSummaryDto> slowTraces;
    private final List<RagTraceSummaryDto> anomalyTraces;

    public RagMetricsDto(
            long totalTraces,
            long failedTraces,
            long lowConfidenceTraces,
            long noAnswerTraces,
            long reviewRequiredTraces,
            long negativeFeedbackTraces,
            double averageDurationMs,
            double providerFailureRate,
            double lowConfidenceRate,
            double noAnswerRate,
            double reviewTriggerRate,
            double negativeFeedbackRate,
            List<RagTraceSummaryDto> slowTraces,
            List<RagTraceSummaryDto> anomalyTraces) {
        this.totalTraces = totalTraces;
        this.failedTraces = failedTraces;
        this.lowConfidenceTraces = lowConfidenceTraces;
        this.noAnswerTraces = noAnswerTraces;
        this.reviewRequiredTraces = reviewRequiredTraces;
        this.negativeFeedbackTraces = negativeFeedbackTraces;
        this.averageDurationMs = averageDurationMs;
        this.providerFailureRate = providerFailureRate;
        this.lowConfidenceRate = lowConfidenceRate;
        this.noAnswerRate = noAnswerRate;
        this.reviewTriggerRate = reviewTriggerRate;
        this.negativeFeedbackRate = negativeFeedbackRate;
        this.slowTraces = slowTraces;
        this.anomalyTraces = anomalyTraces;
    }

    public long getTotalTraces() { return totalTraces; }
    public long getFailedTraces() { return failedTraces; }
    public long getLowConfidenceTraces() { return lowConfidenceTraces; }
    public long getNoAnswerTraces() { return noAnswerTraces; }
    public long getReviewRequiredTraces() { return reviewRequiredTraces; }
    public long getNegativeFeedbackTraces() { return negativeFeedbackTraces; }
    public double getAverageDurationMs() { return averageDurationMs; }
    public double getProviderFailureRate() { return providerFailureRate; }
    public double getLowConfidenceRate() { return lowConfidenceRate; }
    public double getNoAnswerRate() { return noAnswerRate; }
    public double getReviewTriggerRate() { return reviewTriggerRate; }
    public double getNegativeFeedbackRate() { return negativeFeedbackRate; }
    public List<RagTraceSummaryDto> getSlowTraces() { return slowTraces; }
    public List<RagTraceSummaryDto> getAnomalyTraces() { return anomalyTraces; }
}
