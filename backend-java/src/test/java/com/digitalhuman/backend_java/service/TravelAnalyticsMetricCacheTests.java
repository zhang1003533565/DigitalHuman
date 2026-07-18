package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;

class TravelAnalyticsMetricCacheTests {

    @Test
    void invalidateAllDropsCachedEntry() {
        MutableClock clock = new MutableClock(Instant.parse("2026-07-18T00:00:00Z"));
        TravelAnalyticsMetricCache cache = new TravelAnalyticsMetricCache(clock);
        AtomicInteger supplierCalls = new AtomicInteger();

        TravelAnalyticsMetricResponse first = cache.getOrCompute(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND,
                () -> response(supplierCalls.incrementAndGet()));

        assertSame(first, cache.getOrCompute(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND,
                () -> response(supplierCalls.incrementAndGet())));

        cache.invalidateAll();

        TravelAnalyticsMetricResponse second = cache.getOrCompute(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND,
                () -> response(supplierCalls.incrementAndGet()));

        assertNotSame(first, second);
        assertEquals(2, supplierCalls.get());
    }

    @Test
    void entryExpiresAfterSixtySeconds() {
        MutableClock clock = new MutableClock(Instant.parse("2026-07-18T00:00:00Z"));
        TravelAnalyticsMetricCache cache = new TravelAnalyticsMetricCache(clock);
        AtomicInteger supplierCalls = new AtomicInteger();

        TravelAnalyticsMetricResponse first = cache.getOrCompute(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND,
                () -> response(supplierCalls.incrementAndGet()));

        clock.advanceSeconds(59);
        assertSame(first, cache.getOrCompute(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND,
                () -> response(supplierCalls.incrementAndGet())));

        clock.advanceSeconds(1);
        TravelAnalyticsMetricResponse second = cache.getOrCompute(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND,
                () -> response(supplierCalls.incrementAndGet()));

        assertNotSame(first, second);
        assertEquals(2, supplierCalls.get());
    }

    @Test
    void cacheNeverExceedsTenEntriesBecauseValidKeySpaceIsBounded() {
        MutableClock clock = new MutableClock(Instant.parse("2026-07-18T00:00:00Z"));
        TravelAnalyticsMetricCache cache = new TravelAnalyticsMetricCache(clock);
        AtomicInteger supplierCalls = new AtomicInteger();

        for (TravelAnalyticsAudience audience : TravelAnalyticsAudience.values()) {
            for (TravelAnalyticsMetric metric : TravelAnalyticsMetric.values()) {
                cache.getOrCompute(audience, metric, () -> response(supplierCalls.incrementAndGet()));
                clock.advanceSeconds(1);
            }
        }

        TravelAnalyticsMetricResponse first = cache.getOrCompute(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND,
                () -> response(supplierCalls.incrementAndGet()));
        TravelAnalyticsMetricResponse second = cache.getOrCompute(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND,
                () -> response(supplierCalls.incrementAndGet()));

        assertSame(first, second);
        assertEquals(Arrays.stream(TravelAnalyticsAudience.values()).toList().size()
                * Arrays.stream(TravelAnalyticsMetric.values()).toList().size(), supplierCalls.get());
        assertEquals(10, cache.entryCount());
    }

    private TravelAnalyticsMetricResponse response(int value) {
        return new TravelAnalyticsMetricResponse(
                TravelAnalyticsMetric.AVERAGE_SPEND,
                TravelAnalyticsAudience.PUBLIC,
                12,
                10,
                null,
                List.of(new TravelAnalyticsMetricResponse.Item("平均消费（元）", BigDecimal.valueOf(value))),
                "cached response",
                null
        );
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }

        private void advanceSeconds(long seconds) {
            instant = instant.plusSeconds(seconds);
        }
    }
}
