package com.digitalhuman.backend_java.service;

import java.math.BigInteger;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

public class LiveTimelineResolver {

    public Position resolve(Instant publishedAt, Instant serverTime, List<TimelineItem> items) {
        if (items.isEmpty()) {
            throw new IllegalArgumentException("直播文案不能为空");
        }
        long total = 0;
        for (TimelineItem item : items) {
            if (item.durationMs() <= 0) {
                throw new IllegalArgumentException("直播文案时长必须大于零");
            }
            try {
                total = Math.addExact(total, item.durationMs());
            } catch (ArithmeticException exception) {
                throw new IllegalArgumentException("直播文案总时长超出范围", exception);
            }
        }
        long cycle = resolveCycleOffset(publishedAt, serverTime, total);
        long cursor = 0;
        for (int index = 0; index < items.size(); index++) {
            TimelineItem item = items.get(index);
            long nextCursor;
            try {
                nextCursor = Math.addExact(cursor, item.durationMs());
            } catch (ArithmeticException exception) {
                throw new IllegalArgumentException("直播文案总时长超出范围", exception);
            }
            if (cycle < nextCursor) {
                return new Position(item.itemId(), index, cycle - cursor, cycle, total);
            }
            cursor = nextCursor;
        }
        throw new IllegalStateException("直播时间轴无法定位");
    }

    private long resolveCycleOffset(Instant publishedAt, Instant serverTime, long totalDurationMs) {
        if (serverTime.isBefore(publishedAt)) {
            return 0;
        }
        Duration elapsed = Duration.between(publishedAt, serverTime);
        BigInteger elapsedMs = BigInteger.valueOf(elapsed.getSeconds())
                .multiply(BigInteger.valueOf(1_000))
                .add(BigInteger.valueOf(elapsed.getNano() / 1_000_000));
        return elapsedMs.mod(BigInteger.valueOf(totalDurationMs)).longValueExact();
    }

    public record TimelineItem(Long itemId, long durationMs) {
    }

    public record Position(
            Long itemId,
            int itemIndex,
            long itemOffsetMs,
            long cycleOffsetMs,
            long totalDurationMs
    ) {
    }
}
