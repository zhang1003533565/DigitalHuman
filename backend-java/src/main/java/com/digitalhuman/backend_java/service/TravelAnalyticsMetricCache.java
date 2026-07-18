package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Service
public class TravelAnalyticsMetricCache {

    private static final Duration TTL = Duration.ofSeconds(60);
    private static final int MAX_ENTRIES = 10;

    private final ConcurrentHashMap<CacheKey, CacheEntry> entries = new ConcurrentHashMap<>();
    private final Clock clock;

    public TravelAnalyticsMetricCache() {
        this(Clock.systemDefaultZone());
    }

    TravelAnalyticsMetricCache(Clock clock) {
        this.clock = clock;
    }

    public TravelAnalyticsMetricResponse getOrCompute(
            TravelAnalyticsAudience audience,
            TravelAnalyticsMetric metric,
            Supplier<TravelAnalyticsMetricResponse> supplier) {
        CacheKey key = new CacheKey(audience, metric);
        Instant now = clock.instant();
        CacheEntry cached = entries.get(key);
        if (cached != null && !cached.isExpiredAt(now)) {
            return cached.response();
        }

        synchronized (this) {
            now = clock.instant();
            cached = entries.get(key);
            if (cached != null && !cached.isExpiredAt(now)) {
                return cached.response();
            }

            removeExpiredEntries(now);
            TravelAnalyticsMetricResponse computed = supplier.get();
            entries.put(key, new CacheEntry(computed, now.plus(TTL)));
            assertWithinBound();
            return computed;
        }
    }

    public synchronized void invalidateAll() {
        entries.clear();
    }

    private void removeExpiredEntries(Instant now) {
        entries.entrySet().removeIf(entry -> entry.getValue().isExpiredAt(now));
    }

    int entryCount() {
        return entries.size();
    }

    private void assertWithinBound() {
        if (entries.size() > MAX_ENTRIES) {
            throw new IllegalStateException("Travel analytics metric cache exceeded bounded key-space");
        }
    }

    private record CacheKey(TravelAnalyticsAudience audience, TravelAnalyticsMetric metric) {
        private CacheKey {
            Objects.requireNonNull(audience, "audience");
            Objects.requireNonNull(metric, "metric");
        }
    }

    private record CacheEntry(TravelAnalyticsMetricResponse response, Instant expiresAt) {
        private boolean isExpiredAt(Instant instant) {
            return !expiresAt.isAfter(instant);
        }
    }
}
