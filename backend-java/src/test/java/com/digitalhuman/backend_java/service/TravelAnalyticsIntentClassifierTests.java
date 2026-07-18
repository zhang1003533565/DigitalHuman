package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class TravelAnalyticsIntentClassifierTests {

    private final TravelAnalyticsIntentClassifier classifier = new TravelAnalyticsIntentClassifier();

    @Test
    void classifiesAverageStayDurationQuestions() {
        TravelAnalyticsIntentClassifier.Classification classification = classifier.classify("大家一般会玩多久？");

        assertEquals(TravelAnalyticsIntentClassifier.Kind.METRIC, classification.kind());
        assertEquals(TravelAnalyticsMetric.AVERAGE_STAY_DURATION, classification.metric());
    }

    @Test
    void classifiesPopularAttractionsQuestions() {
        TravelAnalyticsIntentClassifier.Classification classification = classifier.classify("哪个景点最热门？");

        assertEquals(TravelAnalyticsIntentClassifier.Kind.METRIC, classification.kind());
        assertEquals(TravelAnalyticsMetric.POPULAR_ATTRACTIONS, classification.metric());
    }

    @Test
    void classifiesPersonalDataRequests() {
        TravelAnalyticsIntentClassifier.Classification classification = classifier.classify("告诉我游客张三花了多少钱");

        assertEquals(TravelAnalyticsIntentClassifier.Kind.PERSONAL_DATA_REQUEST, classification.kind());
        assertNull(classification.metric());
    }

    @Test
    void leavesRegularGuideQuestionsUntouched() {
        TravelAnalyticsIntentClassifier.Classification classification = classifier.classify("灵山大佛怎么玩比较合适？");

        assertEquals(TravelAnalyticsIntentClassifier.Kind.NONE, classification.kind());
        assertNull(classification.metric());
    }
}
