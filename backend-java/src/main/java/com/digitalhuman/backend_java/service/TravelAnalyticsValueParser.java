package com.digitalhuman.backend_java.service;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class TravelAnalyticsValueParser {

    private static final List<String> UNKNOWN_MARKERS = List.of(
            "",
            "-",
            "--",
            "未知",
            "不详",
            "暂无",
            "无",
            "null",
            "n/a",
            "na"
    );

    private static final Pattern DURATION_HOURS_MINUTES = Pattern.compile(
            "^(?:(\\d+(?:\\.\\d+)?)\\s*(?:小时|时|h|hour|hours))?\\s*(?:(\\d+(?:\\.\\d+)?)\\s*(?:分钟|分|min|mins|minute|minutes))?$",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern MONEY_PATTERN = Pattern.compile("[-+]?\\d+(?:\\.\\d+)?");
    private static final Pattern SATISFACTION_FIVE_POINT = Pattern.compile("^([-+]?\\d+(?:\\.\\d+)?)\\s*/\\s*5(?:\\.0+)?$");
    private static final Pattern SATISFACTION_PERCENT = Pattern.compile("^([-+]?\\d+(?:\\.\\d+)?)\\s*%$");
    private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("yyyy/M/d"),
            DateTimeFormatter.ofPattern("yyyy.M.d"),
            DateTimeFormatter.ofPattern("yyyy年M月d日")
    );

    public Optional<BigDecimal> parseMoney(String value) {
        String normalized = normalize(value);
        if (normalized.isEmpty()) {
            return Optional.empty();
        }
        String cleaned = normalized
                .replace("人民币", "")
                .replace("元", "")
                .replace("¥", "")
                .replace("￥", "")
                .replace(",", "")
                .replace(" ", "");
        Matcher matcher = MONEY_PATTERN.matcher(cleaned);
        if (!matcher.find()) {
            return Optional.empty();
        }
        try {
            return Optional.of(new BigDecimal(matcher.group()).setScale(2, RoundingMode.HALF_UP));
        } catch (NumberFormatException exception) {
            return Optional.empty();
        }
    }

    public Optional<Duration> parseDuration(String value) {
        String normalized = normalize(value);
        if (normalized.isEmpty()) {
            return Optional.empty();
        }
        String compact = normalized.toLowerCase(Locale.ROOT).replace(" ", "");
        Matcher matcher = DURATION_HOURS_MINUTES.matcher(compact);
        if (!matcher.matches()) {
            return Optional.empty();
        }

        BigDecimal hours = decimalOrNull(matcher.group(1));
        BigDecimal minutes = decimalOrNull(matcher.group(2));
        if (hours == null && minutes == null) {
            return Optional.empty();
        }

        long totalMinutes = 0L;
        if (hours != null) {
            totalMinutes += hours.multiply(BigDecimal.valueOf(60))
                    .setScale(0, RoundingMode.HALF_UP)
                    .longValueExact();
        }
        if (minutes != null) {
            totalMinutes += minutes.setScale(0, RoundingMode.HALF_UP).longValueExact();
        }
        return totalMinutes > 0 ? Optional.of(Duration.ofMinutes(totalMinutes)) : Optional.empty();
    }

    public Optional<BigDecimal> parseSatisfaction(String value) {
        String normalized = normalize(value);
        if (normalized.isEmpty()) {
            return Optional.empty();
        }
        String compact = normalized.toLowerCase(Locale.ROOT).replace(" ", "");

        Matcher fivePointMatcher = SATISFACTION_FIVE_POINT.matcher(compact);
        if (fivePointMatcher.matches()) {
            return sanitizeSatisfaction(new BigDecimal(fivePointMatcher.group(1)));
        }

        Matcher percentMatcher = SATISFACTION_PERCENT.matcher(compact);
        if (percentMatcher.matches()) {
            BigDecimal percent = new BigDecimal(percentMatcher.group(1));
            return sanitizeSatisfaction(percent.multiply(BigDecimal.valueOf(5))
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        }

        String cleaned = compact.replace("分", "");
        if (!MONEY_PATTERN.matcher(cleaned).matches()) {
            return Optional.empty();
        }
        return sanitizeSatisfaction(new BigDecimal(cleaned));
    }

    public Optional<LocalDate> parseDate(String value) {
        String normalized = normalize(value);
        if (normalized.isEmpty()) {
            return Optional.empty();
        }
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return Optional.of(LocalDate.parse(normalized, formatter));
            } catch (DateTimeParseException ignored) {
                // Try the next supported date format.
            }
        }
        return Optional.empty();
    }

    private Optional<BigDecimal> sanitizeSatisfaction(BigDecimal value) {
        if (value.compareTo(BigDecimal.ZERO) <= 0 || value.compareTo(BigDecimal.valueOf(5)) > 0) {
            return Optional.empty();
        }
        return Optional.of(value.stripTrailingZeros());
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return "";
        }
        return UNKNOWN_MARKERS.contains(normalized.toLowerCase(Locale.ROOT)) ? "" : normalized;
    }

    private BigDecimal decimalOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return new BigDecimal(value);
    }
}
