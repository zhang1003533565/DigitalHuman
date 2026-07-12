package com.digitalhuman.backend_java.service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

public class LiveTimelineResolver {

    public Position resolve(Instant publishedAt, Instant serverTime, List<TimelineItem> items) {
        long total = items.stream().mapToLong(TimelineItem::durationMs).sum();
        if (items.isEmpty() || total <= 0) {
            throw new IllegalArgumentException("直播文案不能为空");
        }
        long elapsed = Math.max(0, Duration.between(publishedAt, serverTime).toMillis());
        long cycle = elapsed % total;
        long cursor = 0;
        for (int index = 0; index < items.size(); index++) {
            TimelineItem item = items.get(index);
            if (cycle < cursor + item.durationMs()) {
                return new Position(item.itemId(), index, cycle - cursor, cycle, total);
            }
            cursor += item.durationMs();
        }
        throw new IllegalStateException("直播时间轴无法定位");
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
