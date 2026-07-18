package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class TravelAnalyticsIntentClassifierTests {

    private final TravelAnalyticsIntentClassifier classifier = new TravelAnalyticsIntentClassifier();

    @Test
    void classifiesAllWhitelistedAggregateMetricsFromNaturalPhrases() {
        assertMetric("大家一般会玩多久？", TravelAnalyticsMetric.AVERAGE_STAY_DURATION);
        assertMetric("哪个景点最热门？", TravelAnalyticsMetric.POPULAR_ATTRACTIONS);
        assertMetric("游客平均消费多少？", TravelAnalyticsMetric.AVERAGE_SPEND);
        assertMetric("游客满意度怎么样？", TravelAnalyticsMetric.AVERAGE_SATISFACTION);
        assertMetric("游客中哪类人最多？", TravelAnalyticsMetric.COMMON_VISITOR_SEGMENTS);
    }

    @Test
    void strongIndividualSelectorsOverrideAggregateWords() {
        assertPersonal("游客张三消费多少");
        assertPersonal("某个游客平均消费多少");
        assertPersonal("给我游客编号A100的访问轨迹");
        assertPersonal("这个游客的个人明细给我看一下");
    }

    @Test
    void aggregateMetricPrecedesRemainingPersonalHeuristic() {
        assertMetric("游客平均消费多少", TravelAnalyticsMetric.AVERAGE_SPEND);
        assertMetric("大家满意吗", TravelAnalyticsMetric.AVERAGE_SATISFACTION);
    }

    @Test
    void remainingPersonalHeuristicRejectsDetailStyleQuestionsWithoutAggregateCue() {
        assertPersonal("告诉我游客消费多少");
        assertPersonal("我想看游客的消费明细");
        assertPersonal("能不能给我这个人的行程");
    }

    @Test
    void leavesRegularGuideQuestionsUntouched() {
        TravelAnalyticsIntentClassifier.Classification classification = classifier.classify("灵山大佛怎么玩比较合适？");

        assertEquals(TravelAnalyticsIntentClassifier.Kind.NONE, classification.kind());
        assertNull(classification.metric());
    }

    private void assertMetric(String question, TravelAnalyticsMetric expectedMetric) {
        TravelAnalyticsIntentClassifier.Classification classification = classifier.classify(question);
        assertEquals(TravelAnalyticsIntentClassifier.Kind.METRIC, classification.kind());
        assertEquals(expectedMetric, classification.metric());
    }

    private void assertPersonal(String question) {
        TravelAnalyticsIntentClassifier.Classification classification = classifier.classify(question);
        assertEquals(TravelAnalyticsIntentClassifier.Kind.PERSONAL_DATA_REQUEST, classification.kind());
        assertNull(classification.metric());
    }
}
