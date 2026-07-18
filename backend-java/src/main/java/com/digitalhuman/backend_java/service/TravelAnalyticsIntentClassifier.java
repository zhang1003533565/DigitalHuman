package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class TravelAnalyticsIntentClassifier {

    public Classification classify(String question) {
        String normalized = normalize(question);
        if (normalized.isEmpty()) {
            return new Classification(Kind.NONE, null);
        }
        if (isPersonalDataRequest(normalized)) {
            return new Classification(Kind.PERSONAL_DATA_REQUEST, null);
        }

        TravelAnalyticsMetric metric = detectMetric(normalized);
        if (metric != null) {
            return new Classification(Kind.METRIC, metric);
        }
        return new Classification(Kind.NONE, null);
    }

    private boolean isPersonalDataRequest(String normalized) {
        if (normalized.contains("tourist_id") || normalized.contains("游客id") || normalized.contains("游客编号")) {
            return true;
        }
        if (normalized.contains("昵称") || normalized.contains("姓名") || normalized.contains("明细") || normalized.contains("轨迹")) {
            return true;
        }
        if (normalized.contains("个人数据") || normalized.contains("个人信息") || normalized.contains("联系方式")) {
            return true;
        }
        return normalized.contains("游客") && (
                normalized.contains("花了") ||
                normalized.contains("消费") ||
                normalized.contains("住了") ||
                normalized.contains("去了") ||
                normalized.contains("行程")
        );
    }

    private TravelAnalyticsMetric detectMetric(String normalized) {
        if (containsAny(normalized, "玩多久", "待多久", "停留多久", "平均停留", "一般会玩多久", "平均游玩时长")) {
            return TravelAnalyticsMetric.AVERAGE_STAY_DURATION;
        }
        if ((normalized.contains("景点") || normalized.contains("景区") || normalized.contains("项目"))
                && containsAny(normalized, "最热门", "热门", "最火", "最受欢迎")) {
            return TravelAnalyticsMetric.POPULAR_ATTRACTIONS;
        }
        if (containsAny(normalized, "人均消费", "平均消费", "平均花费", "平均花多少钱", "一般花多少钱")) {
            return TravelAnalyticsMetric.AVERAGE_SPEND;
        }
        if (containsAny(normalized, "满意度", "满意吗", "评价怎么样", "评分怎么样")) {
            return TravelAnalyticsMetric.AVERAGE_SATISFACTION;
        }
        if (containsAny(normalized, "游客画像", "客群", "人群", "什么类型游客", "都是什么人")) {
            return TravelAnalyticsMetric.COMMON_VISITOR_SEGMENTS;
        }
        return null;
    }

    private boolean containsAny(String normalized, String... patterns) {
        for (String pattern : patterns) {
            if (normalized.contains(pattern)) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String question) {
        return question == null ? "" : question
                .trim()
                .replace(" ", "")
                .toLowerCase(Locale.ROOT);
    }

    public enum Kind {
        NONE,
        METRIC,
        PERSONAL_DATA_REQUEST
    }

    public record Classification(Kind kind, TravelAnalyticsMetric metric) {
    }
}
