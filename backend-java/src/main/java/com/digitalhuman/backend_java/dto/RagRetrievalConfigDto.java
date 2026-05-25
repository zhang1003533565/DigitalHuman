package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class RagRetrievalConfigDto {
    @JsonProperty("topK")
    private int topK;
    @JsonProperty("retrieveLimit")
    private int retrieveLimit;
    @JsonProperty("rerankLimit")
    private int rerankLimit;
    @JsonProperty("scoreThreshold")
    private double scoreThreshold;
    @JsonProperty("hybridEnabled")
    private boolean hybridEnabled;
    @JsonProperty("rerankerEnabled")
    private boolean rerankerEnabled;

    public int getTopK() { return topK; }
    public void setTopK(int topK) { this.topK = topK; }
    public int getRetrieveLimit() { return retrieveLimit; }
    public void setRetrieveLimit(int retrieveLimit) { this.retrieveLimit = retrieveLimit; }
    public int getRerankLimit() { return rerankLimit; }
    public void setRerankLimit(int rerankLimit) { this.rerankLimit = rerankLimit; }
    public double getScoreThreshold() { return scoreThreshold; }
    public void setScoreThreshold(double scoreThreshold) { this.scoreThreshold = scoreThreshold; }
    public boolean isHybridEnabled() { return hybridEnabled; }
    public void setHybridEnabled(boolean hybridEnabled) { this.hybridEnabled = hybridEnabled; }
    public boolean isRerankerEnabled() { return rerankerEnabled; }
    public void setRerankerEnabled(boolean rerankerEnabled) { this.rerankerEnabled = rerankerEnabled; }
}
