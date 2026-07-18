package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.model.TravelAnalyticsRecord;
import com.digitalhuman.backend_java.repository.TravelAnalyticsRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
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
    private static final Pattern AGE_PATTERN = Pattern.compile("^(\\d+)(?:岁)?$");
    private static final Set<String> MALE_ALIASES = Set.of("男", "male", "m", "man");
    private static final Set<String> FEMALE_ALIASES = Set.of("女", "female", "f", "woman");
    private static final Set<String> OTHER_GENDER_ALIASES = Set.of("其他", "其它", "非二元", "non-binary", "nonbinary", "other");

    private final TravelAnalyticsRecordRepository recordRepository;
    private final TravelAnalyticsValueParser valueParser;
    private final Clock clock;

    @Autowired
    public TravelAnalyticsMetricService(
            TravelAnalyticsRecordRepository recordRepository,
            TravelAnalyticsValueParser valueParser) {
        this(recordRepository, valueParser, Clock.systemDefaultZone());
    }

    TravelAnalyticsMetricService(
            TravelAnalyticsRecordRepository recordRepository,
            TravelAnalyticsValueParser valueParser,
            Clock clock) {
        this.recordRepository = recordRepository;
        this.valueParser = valueParser;
        this.clock = clock;
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
        LocalDateTime asOf = latestUpdatedAt(records);
        long validSamples = 0;

        for (TravelAnalyticsRecord record : records) {
            String attractionName = normalize(record.getAttraction_name());
            if (attractionName.isEmpty()) {
                continue;
            }
            counts.merge(attractionName, 1, Integer::sum);
            validSamples++;
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
                zeroRowMethodology(records, "按 attraction_name 分组统计有效记录数，仅返回前 5 项"),
                zeroRowBreakdownWarning(records, audience, validSamples, items.isEmpty())
        );
    }

    private TravelAnalyticsMetricResponse buildAverageStayDurationResponse(
            TravelAnalyticsAudience audience,
            List<TravelAnalyticsRecord> records) {
        BigDecimal totalMinutes = BigDecimal.ZERO;
        long validSamples = 0;
        LocalDateTime asOf = latestUpdatedAt(records);

        for (TravelAnalyticsRecord record : records) {
            Optional<Duration> duration = valueParser.parseDuration(record.getStay_duration());
            if (duration.isEmpty()) {
                continue;
            }
            totalMinutes = totalMinutes.add(BigDecimal.valueOf(duration.get().toMinutes()));
            validSamples++;
        }

        return new TravelAnalyticsMetricResponse(
                TravelAnalyticsMetric.AVERAGE_STAY_DURATION,
                audience,
                records.size(),
                validSamples,
                asOf,
                averageItems("平均停留时长（分钟）", totalMinutes, validSamples),
                zeroRowMethodology(records, "基于可解析停留时长的平均值，单位：分钟"),
                zeroRowWarning(records, validSamples)
        );
    }

    private TravelAnalyticsMetricResponse buildAverageSpendResponse(
            TravelAnalyticsAudience audience,
            List<TravelAnalyticsRecord> records) {
        BigDecimal totalAmount = BigDecimal.ZERO;
        long validSamples = 0;
        LocalDateTime asOf = latestUpdatedAt(records);

        for (TravelAnalyticsRecord record : records) {
            Optional<BigDecimal> amount = parseSpend(record);
            if (amount.isEmpty()) {
                continue;
            }
            totalAmount = totalAmount.add(amount.get());
            validSamples++;
        }

        return new TravelAnalyticsMetricResponse(
                TravelAnalyticsMetric.AVERAGE_SPEND,
                audience,
                records.size(),
                validSamples,
                asOf,
                averageItems("平均消费（元）", totalAmount, validSamples),
                zeroRowMethodology(records, "total_cost 优先，缺失时回退到五类分项费用累加"),
                zeroRowWarning(records, validSamples)
        );
    }

    private TravelAnalyticsMetricResponse buildAverageSatisfactionResponse(
            TravelAnalyticsAudience audience,
            List<TravelAnalyticsRecord> records) {
        BigDecimal totalSatisfaction = BigDecimal.ZERO;
        long validSamples = 0;
        LocalDateTime asOf = latestUpdatedAt(records);

        for (TravelAnalyticsRecord record : records) {
            Optional<BigDecimal> satisfaction = valueParser.parseSatisfaction(record.getSatisfaction());
            if (satisfaction.isEmpty()) {
                continue;
            }
            totalSatisfaction = totalSatisfaction.add(satisfaction.get());
            validSamples++;
        }

        return new TravelAnalyticsMetricResponse(
                TravelAnalyticsMetric.AVERAGE_SATISFACTION,
                audience,
                records.size(),
                validSamples,
                asOf,
                averageItems("平均满意度（5分制）", totalSatisfaction, validSamples),
                zeroRowMethodology(records, "基于可解析满意度的平均值，统一按 5 分制"),
                zeroRowWarning(records, validSamples)
        );
    }

    private TravelAnalyticsMetricResponse buildCommonVisitorSegmentsResponse(
            TravelAnalyticsAudience audience,
            List<TravelAnalyticsRecord> records) {
        LinkedHashMap<String, Integer> counts = new LinkedHashMap<>();
        LocalDateTime asOf = latestUpdatedAt(records);
        long validSamples = 0;

        for (TravelAnalyticsRecord record : records) {
            Optional<String> label = buildSegmentLabel(record);
            if (label.isEmpty()) {
                continue;
            }
            counts.merge(label.get(), 1, Integer::sum);
            validSamples++;
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
                zeroRowMethodology(records, "按年龄段和性别分组统计有效记录数，仅返回前 5 项"),
                zeroRowBreakdownWarning(records, audience, validSamples, items.isEmpty())
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
        String totalCostRaw = record.getTotal_cost();
        if (!normalize(totalCostRaw).isEmpty()) {
            return valueParser.parseMoney(totalCostRaw);
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
        Optional<Integer> age = parseAge(record.getAge());
        Optional<String> gender = normalizeGender(record.getGender());
        if (age.isEmpty() || gender.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(ageBand(age.get()) + " / " + gender.get());
    }

    private Optional<Integer> parseAge(String raw) {
        String normalized = normalize(raw);
        if (normalized.isEmpty()) {
            return Optional.empty();
        }
        Matcher matcher = AGE_PATTERN.matcher(normalized);
        if (!matcher.matches()) {
            return Optional.empty();
        }
        return Optional.of(Integer.parseInt(matcher.group(1)));
    }

    private Optional<String> normalizeGender(String raw) {
        String normalized = normalize(raw).toLowerCase();
        if (normalized.isEmpty()) {
            return Optional.empty();
        }
        if (MALE_ALIASES.contains(normalized)) {
            return Optional.of("男");
        }
        if (FEMALE_ALIASES.contains(normalized)) {
            return Optional.of("女");
        }
        if (OTHER_GENDER_ALIASES.contains(normalized)) {
            return Optional.of("其他");
        }
        return Optional.empty();
    }

    private String ageBand(int age) {
        if (age < 18) {
            return "<18";
        }
        if (age <= 29) {
            return "18-29";
        }
        if (age <= 44) {
            return "30-44";
        }
        if (age <= 59) {
            return "45-59";
        }
        return "60+";
    }

    private LocalDateTime latestUpdatedAt(List<TravelAnalyticsRecord> records) {
        if (records.isEmpty()) {
            return LocalDateTime.now(clock);
        }
        LocalDateTime asOf = null;
        for (TravelAnalyticsRecord record : records) {
            asOf = latest(asOf, record.getUpdatedAt());
        }
        return asOf;
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

    private String zeroRowMethodology(List<TravelAnalyticsRecord> records, String defaultMethodology) {
        if (records.isEmpty()) {
            return "当前无来源记录，asOf 为本次计算时间";
        }
        return defaultMethodology;
    }

    private String zeroRowWarning(List<TravelAnalyticsRecord> records, long validSamples) {
        if (records.isEmpty()) {
            return "暂无来源数据，asOf 为本次计算时间";
        }
        return validSamples == 0 ? "暂无有效数据" : null;
    }

    private String zeroRowBreakdownWarning(
            List<TravelAnalyticsRecord> records,
            TravelAnalyticsAudience audience,
            long validSamples,
            boolean itemsEmpty) {
        if (records.isEmpty()) {
            return "暂无来源数据，asOf 为本次计算时间";
        }
        return buildThresholdWarning(audience, validSamples, true, itemsEmpty);
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
