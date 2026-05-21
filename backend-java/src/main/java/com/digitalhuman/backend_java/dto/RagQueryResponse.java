package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class RagQueryResponse {

    private String answer;
    @JsonProperty("related_spots")
    private List<String> relatedSpots;
    private List<RagSourceDto> sources;

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public List<String> getRelatedSpots() {
        return relatedSpots;
    }

    public void setRelatedSpots(List<String> relatedSpots) {
        this.relatedSpots = relatedSpots;
    }

    public List<RagSourceDto> getSources() {
        return sources;
    }

    public void setSources(List<RagSourceDto> sources) {
        this.sources = sources;
    }
}
