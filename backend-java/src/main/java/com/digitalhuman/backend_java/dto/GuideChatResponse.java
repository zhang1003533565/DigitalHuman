package com.digitalhuman.backend_java.dto;

import java.util.List;

public class GuideChatResponse {

    private final String sessionId;
    private final String traceId;
    private final Long messageId;
    private final String answerText;
    private final List<String> relatedSpots;
    private final List<String> recommendedRoutes;
    private final List<String> suggestions;
    private final List<GuideSourceDto> sources;

    public GuideChatResponse(String sessionId, String traceId, String answerText, List<String> relatedSpots, List<String> recommendedRoutes, List<GuideSourceDto> sources) {
        this(sessionId, traceId, answerText, relatedSpots, recommendedRoutes, List.of(), sources);
    }

    public GuideChatResponse(String sessionId, String traceId, String answerText, List<String> relatedSpots, List<String> recommendedRoutes, List<String> suggestions, List<GuideSourceDto> sources) {
        this(sessionId, traceId, null, answerText, relatedSpots, recommendedRoutes, suggestions, sources);
    }

    public GuideChatResponse(String sessionId, String traceId, Long messageId, String answerText, List<String> relatedSpots, List<String> recommendedRoutes, List<String> suggestions, List<GuideSourceDto> sources) {
        this.sessionId = sessionId;
        this.traceId = traceId;
        this.messageId = messageId;
        this.answerText = answerText;
        this.relatedSpots = relatedSpots;
        this.recommendedRoutes = recommendedRoutes;
        this.suggestions = suggestions;
        this.sources = sources;
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getTraceId() {
        return traceId;
    }

    public Long getMessageId() { return messageId; }

    public String getAnswerText() {
        return answerText;
    }

    public List<String> getRelatedSpots() {
        return relatedSpots;
    }

    public List<String> getRecommendedRoutes() {
        return recommendedRoutes;
    }

    public List<String> getSuggestions() {
        return suggestions;
    }

    public List<GuideSourceDto> getSources() {
        return sources;
    }
}
