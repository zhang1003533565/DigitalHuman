package com.digitalhuman.backend_java.dto;

import java.util.List;

public class GuideChatResponse {

    private final String sessionId;
    private final String answerText;
    private final List<String> relatedSpots;
    private final List<String> recommendedRoutes;

    public GuideChatResponse(String sessionId, String answerText, List<String> relatedSpots, List<String> recommendedRoutes) {
        this.sessionId = sessionId;
        this.answerText = answerText;
        this.relatedSpots = relatedSpots;
        this.recommendedRoutes = recommendedRoutes;
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getAnswerText() {
        return answerText;
    }

    public List<String> getRelatedSpots() {
        return relatedSpots;
    }

    public List<String> getRecommendedRoutes() {
        return recommendedRoutes;
    }
}
