package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class TravelAnalyticsIntentClassifier {
    private static final Pattern NAMED_VISITOR_PATTERN = Pattern.compile(
            "游客(?!平均|整体|满意|画像|中哪|都是什么|一般|通常)[\\p{IsHan}]{2,3}(?:花了|消费|花费|住了|去了|去过|行程|轨迹|明细|多少钱)");

    public Classification classify(String question) {
        String normalized = normalize(question);
        if (normalized.isEmpty()) {
            return new Classification(Kind.NONE, null);
        }
        if (hasStrongIndividualSelector(normalized)) {
            return new Classification(Kind.PERSONAL_DATA_REQUEST, null);
        }

        TravelAnalyticsMetric metric = detectMetric(normalized);
        if (metric != null) {
            return new Classification(Kind.METRIC, metric);
        }
        if (isPersonalDataRequest(normalized)) {
            return new Classification(Kind.PERSONAL_DATA_REQUEST, null);
        }
        return new Classification(Kind.NONE, null);
    }

    private boolean hasStrongIndividualSelector(String normalized) {
        return containsAny(normalized,
                "tourist_id",
                "游客id",
                "游客编号",
                "昵称",
                "某个游客",
                "某位游客",
                "该游客",
                "这个游客",
                "单个游客",
                "个人明细",
                "消费明细",
                "访问轨迹",
                "行程轨迹")
                || NAMED_VISITOR_PATTERN.matcher(normalized).find();
    }

    private boolean isPersonalDataRequest(String normalized) {
        if (containsAny(normalized, "姓名", "明细", "轨迹", "个人数据", "个人信息", "联系方式")) {
            return true;
        }
        if (containsAny(normalized, "这个人的行程", "这个人的轨迹", "这个人的明细")) {
            return true;
        }
        return normalized.contains("游客") && containsAny(normalized,
                "花了",
                "消费",
                "花费",
                "住了",
                "去了",
                "去过",
                "行程");
    }

    private TravelAnalyticsMetric detectMetric(String normalized) {
        if (containsAny(normalized,
                "大家一般会玩多久",
                "游客平均停留多久",
                "平均停留",
                "平均游玩时长",
                "整体会玩多久",
                "通常玩多久")) {
            return TravelAnalyticsMetric.AVERAGE_STAY_DURATION;
        }
        if ((normalized.contains("景点") || normalized.contains("景区") || normalized.contains("项目"))
                && containsAny(normalized, "最热门", "热门", "最火", "最受欢迎")) {
            return TravelAnalyticsMetric.POPULAR_ATTRACTIONS;
        }
        if (containsAny(normalized,
                "人均消费",
                "平均消费",
                "平均花费",
                "平均花多少钱",
                "大家一般花多少钱",
                "游客平均消费多少",
                "游客整体花费多少")) {
            return TravelAnalyticsMetric.AVERAGE_SPEND;
        }
        if (containsAny(normalized,
                "平均满意度",
                "游客满意度怎么样",
                "整体评分怎么样",
                "大家满意吗",
                "游客评价如何")) {
            return TravelAnalyticsMetric.AVERAGE_SATISFACTION;
        }
        if (containsAny(normalized,
                "游客画像",
                "游客客群",
                "常见游客群体",
                "什么类型游客最多",
                "都是什么人",
                "游客中哪类人最多")) {
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
