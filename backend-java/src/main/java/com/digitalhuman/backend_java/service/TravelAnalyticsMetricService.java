package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.model.TravelAnalyticsRecord;
import com.digitalhuman.backend_java.repository.TravelAnalyticsRecordRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TravelAnalyticsMetricService {

    private static final Set<TravelAnalyticsMetric> PUBLIC_METRICS = EnumSet.of(
            TravelAnalyticsMetric.POPULAR_ATTRACTIONS,
            TravelAnalyticsMetric.AVERAGE_STAY_DURATION,
            TravelAnalyticsMetric.AVERAGE_SPEND,
            TravelAnalyticsMetric.AVERAGE_SATISFACTION,
            TravelAnalyticsMetric.COMMON_VISITOR_SEGMENTS
    );
    private static final int PUBLIC_MINIMUM_SAMPLE_SIZE = 10;
    private static final int TOP_GROUP_LIMIT = 5;
    private static final Pattern INTEGER_PATTERN = Pattern.compile("(\\d+)");

    private final TravelAnalyticsRecordRepository recordRepository;
    private final TravelAnalyticsValueParser valueParser;

    public TravelAnalyticsMetricService(
            TravelAnalyticsRecordRepository recordRepository,
            TravelAnalyticsValueParser valueParser) {
        this.recordRepository = recordRepository;
        this.valueParser = valueParser;
    }

    public TravelAnalyticsMetricResponse queryMetric(TravelAnalyticsAudience audience, TravelAnalyticsMetric metric) {
        if (audience == TravelAnalyticsAudience.PUBLIC && !PUBLIC_METRICS.contains(metric)) {
            throw new IllegalArgumentException("Unsupported public travel analytics metric: " + metric);
        }

        List<TravelAnalyticsRecord> records = recordRepository.findAllByOrderByUpdatedAtAscIdAsc();
        return switch (metric) {
            case POPULAR_ATTRACTIONS -> buildPopularAttractionsResponse(audience, records);
            case AVERAGE_STAY_DURATION -> buildAverageStayDurationResponse(audience, records);
            case AVERAGE_SPEND -> buildAverageSpendResponse(audience, records);
            case AVERAGE_SATISFACTION -> buildAverageSatisfactionResponse(audience, records);
            case COMMON_VISITOR_SEGMENTS -> buildCommonVisitorSegmentsResponse(audience, records);
        };
    }

    private TravelAnalyticsMetricResponse buildPopularAttractionsResponse(
            TravelAnalyticsAudience audience,
            List<TravelAnalyticsRecord> records) {
        LinkedHashMap<String, Integer> counts = new LinkedHashMap<>();
        LocalDateTime asOf = null;
        long validSamples = 0;

        for (TravelAnalyticsRecord record : records) {
            String attractionName = normalize(record.getAttraction_name());
            if (attractionName.isEmpty()) {
                continue;
            }
            counts.merge(attractionName, 1, Integer::sum);
            validSamples++;
            asOf = latest(asOf, record.getUpdatedAt());
        }

        List<TravelAnalyticsMetricResponse.Item> items = topCounts(counts);
        if (audience == TravelAnalyticsAudience.PUBLIC && validSamples < PUBLIC_MINIMUM_SAMPLE_SIZE) {
            items = List.of();
        }

        return new TravelAnalyticsMetricResponse(
                TravelAnalyticsMetric.POPULAR_ATTRACTIONS,
                audience,
                records.size(),
                validSamples,
                asOf,
                items,
                "按 attraction_name 分组统计有效记录数，仅返回前 5 项",
                buildThresholdWarning(audience, validSamples, true, items.isEmpty())
        );
    }

    private TravelAnalyticsMetricResponse buildAverageStayDurationResponse(
            TravelAnalyticsAudience audience,
            List<TravelAnalyticsRecord> records) {
        BigDecimal totalMinutes = BigDecimal.ZERO;
        long validSamples = 0;
        LocalDateTime asOf = null;

        for (TravelAnalyticsRecord record : records) {
            Optional<Duration> duration = valueParser.parseDuration(record.getStay_duration());
            if (duration.isEmpty()) {
                continue;
            }
            totalMinutes = totalMinutes.add(BigDecimal.valueOf(duration.get().toMinutes()));
            validSamples++;
            asOf = latest(asOf, record.getUpdatedAt());
        }

        return new TravelAnalyticsMetricResponse(
                TravelAnalyticsMetric.AVERAGE_STAY_DURATION,
                audience,
                records.size(),
                validSamples,
                asOf,
                averageItems("平均停留时长（分钟）", totalMinutes, validSamples),
                "基于可解析停留时长的平均值，单位：分钟",
                validSamples == 0 ? "暂无有效数据" : null
        );
    }

    private TravelAnalyticsMetricResponse buildAverageSpendResponse(
            TravelAnalyticsAudience audience,
            List<TravelAnalyticsRecord> records) {
        BigDecimal totalAmount = BigDecimal.ZERO;
        long validSamples = 0;
        LocalDateTime asOf = null;

        for (TravelAnalyticsRecord record : records) {
            Optional<BigDecimal> amount = parseSpend(record);
            if (amount.isEmpty()) {
                continue;
            }
            totalAmount = totalAmount.add(amount.get());
            validSamples++;
            asOf = latest(asOf, record.getUpdatedAt());
        }

        return new TravelAnalyticsMetricResponse(
                TravelAnalyticsMetric.AVERAGE_SPEND,
                audience,
                records.size(),
                validSamples,
                asOf,
                averageItems("平均消费（元）", totalAmount, validSamples),
                "total_cost 优先，缺失时回退到五类分项费用累加",
                validSamples == 0 ? "暂无有效数据" : null
        );
    }

    private TravelAnalyticsMetricResponse buildAverageSatisfactionResponse(
            TravelAnalyticsAudience audience,
            List<TravelAnalyticsRecord> records) {
        BigDecimal totalSatisfaction = BigDecimal.ZERO;
        long validSamples = 0;
        LocalDateTime asOf = null;

        for (TravelAnalyticsRecord record : records) {
            Optional<BigDecimal> satisfaction = valueParser.parseSatisfaction(record.getSatisfaction());
            if (satisfaction.isEmpty()) {
                continue;
            }
            totalSatisfaction = totalSatisfaction.add(satisfaction.get());
            validSamples++;
            asOf = latest(asOf, record.getUpdatedAt());
        }

        return new TravelAnalyticsMetricResponse(
                TravelAnalyticsMetric.AVERAGE_SATISFACTION,
                audience,
                records.size(),
                validSamples,
                asOf,
                averageItems("平均满意度（5分制）", totalSatisfaction, validSamples),
                "基于可解析满意度的平均值，统一按 5 分制",
                validSamples == 0 ? "暂无有效数据" : null
        );
    }

    private TravelAnalyticsMetricResponse buildCommonVisitorSegmentsResponse(
            TravelAnalyticsAudience audience,
            List<TravelAnalyticsRecord> records) {
        LinkedHashMap<String, Integer> counts = new LinkedHashMap<>();
        LocalDateTime asOf = null;
        long validSamples = 0;

        for (TravelAnalyticsRecord record : records) {
            Optional<String> label = buildSegmentLabel(record);
            if (label.isEmpty()) {
                continue;
            }
            counts.merge(label.get(), 1, Integer::sum);
            validSamples++;
            asOf = latest(asOf, record.getUpdatedAt());
        }

        List<TravelAnalyticsMetricResponse.Item> items = topCounts(counts);
        if (audience == TravelAnalyticsAudience.PUBLIC && validSamples < PUBLIC_MINIMUM_SAMPLE_SIZE) {
            items = List.of();
        }

        return new TravelAnalyticsMetricResponse(
                TravelAnalyticsMetric.COMMON_VISITOR_SEGMENTS,
                audience,
                records.size(),
                validSamples,
                asOf,
                items,
                "按年龄段和性别分组统计有效记录数，仅返回前 5 项",
                buildThresholdWarning(audience, validSamples, true, items.isEmpty())
        );
    }

    private List<TravelAnalyticsMetricResponse.Item> averageItems(String label, BigDecimal total, long validSamples) {
        if (validSamples == 0) {
            return List.of();
        }
        BigDecimal average = total.divide(BigDecimal.valueOf(validSamples), 2, RoundingMode.HALF_UP);
        return List.of(new TravelAnalyticsMetricResponse.Item(label, average));
    }

    private List<TravelAnalyticsMetricResponse.Item> topCounts(LinkedHashMap<String, Integer> counts) {
        return counts.entrySet().stream()
                .sorted((left, right) -> Integer.compare(right.getValue(), left.getValue()))
                .limit(TOP_GROUP_LIMIT)
                .map(entry -> new TravelAnalyticsMetricResponse.Item(entry.getKey(), BigDecimal.valueOf(entry.getValue())))
                .toList();
    }

    private Optional<BigDecimal> parseSpend(TravelAnalyticsRecord record) {
        Optional<BigDecimal> totalCost = valueParser.parseMoney(record.getTotal_cost());
        if (totalCost.isPresent()) {
            return totalCost;
        }

        List<Optional<BigDecimal>> components = List.of(
                valueParser.parseMoney(record.getTicket_cost()),
                valueParser.parseMoney(record.getFood_cost()),
                valueParser.parseMoney(record.getShopping_cost()),
                valueParser.parseMoney(record.getTransport_cost()),
                valueParser.parseMoney(record.getEntertainment_cost())
        );
        BigDecimal sum = BigDecimal.ZERO;
        boolean hasAnyComponent = false;
        for (Optional<BigDecimal> component : components) {
            if (component.isEmpty()) {
                continue;
            }
            hasAnyComponent = true;
            sum = sum.add(component.get());
        }
        return hasAnyComponent ? Optional.of(sum.setScale(2, RoundingMode.HALF_UP)) : Optional.empty();
    }

    private Optional<String> buildSegmentLabel(TravelAnalyticsRecord record) {
        Optional<Integer> age = parseInteger(record.getAge());
        String gender = normalize(record.getGender());
        if (age.isEmpty() || gender.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(ageBand(age.get()) + " / " + gender);
    }

    private Optional<Integer> parseInteger(String raw) {
        String normalized = normalize(raw);
        if (normalized.isEmpty()) {
            return Optional.empty();
        }
        Matcher matcher = INTEGER_PATTERN.matcher(normalized);
        if (!matcher.find()) {
            return Optional.empty();
        }
        return Optional.of(Integer.parseInt(matcher.group(1)));
    }

    private String ageBand(int age) {
        if (age < 18) {
            return "18岁以下";
        }
        if (age <= 25) {
            return "18-25岁";
        }
        if (age <= 35) {
            return "26-35岁";
        }
        if (age <= 45) {
            return "36-45岁";
        }
        return "46岁及以上";
    }

    private LocalDateTime latest(LocalDateTime current, LocalDateTime candidate) {
        if (candidate == null) {
            return current;
        }
        if (current == null || candidate.isAfter(current)) {
            return candidate;
        }
        return current;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private String buildThresholdWarning(
            TravelAnalyticsAudience audience,
            long validSamples,
            boolean requiresThreshold,
            boolean itemsEmpty) {
        if (requiresThreshold && audience == TravelAnalyticsAudience.PUBLIC && validSamples < PUBLIC_MINIMUM_SAMPLE_SIZE && itemsEmpty) {
            return "样本不足";
        }
        return validSamples == 0 ? "暂无有效数据" : null;
    }
}
