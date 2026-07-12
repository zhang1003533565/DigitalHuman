package com.digitalhuman.backend_java.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LiveTimelineResolverTests {

    private final LiveTimelineResolver resolver = new LiveTimelineResolver();

    @Test
    void resolvesFirstItemAtPublishTime() {
        Instant start = Instant.parse("2026-07-12T00:00:00Z");

        LiveTimelineResolver.Position position = resolver.resolve(start, start, timeline());

        assertThat(position).isEqualTo(new LiveTimelineResolver.Position(10L, 0, 0, 0, 30_000));
    }

    @Test
    void resolvesNextItemAtItemBoundary() {
        Instant start = Instant.parse("2026-07-12T00:00:00Z");

        LiveTimelineResolver.Position position = resolver.resolve(start, start.plusMillis(10_000), timeline());

        assertThat(position).isEqualTo(new LiveTimelineResolver.Position(20L, 1, 0, 10_000, 30_000));
    }

    @Test
    void restartsAtLoopBoundary() {
        Instant start = Instant.parse("2026-07-12T00:00:00Z");

        LiveTimelineResolver.Position position = resolver.resolve(start, start.plusMillis(30_000), timeline());

        assertThat(position).isEqualTo(new LiveTimelineResolver.Position(10L, 0, 0, 0, 30_000));
    }

    @Test
    void resolvesCurrentItemAfterMultipleLoops() {
        Instant start = Instant.parse("2026-07-12T00:00:00Z");

        LiveTimelineResolver.Position position = resolver.resolve(start, start.plusMillis(75_000), timeline());

        assertThat(position).isEqualTo(new LiveTimelineResolver.Position(20L, 1, 5_000, 15_000, 30_000));
    }

    @Test
    void clampsTimeBeforePublishToStart() {
        Instant start = Instant.parse("2026-07-12T00:00:00Z");

        LiveTimelineResolver.Position position = resolver.resolve(start, start.minusSeconds(2), timeline());

        assertThat(position).isEqualTo(new LiveTimelineResolver.Position(10L, 0, 0, 0, 30_000));
    }

    @Test
    void rejectsNegativeItemDuration() {
        Instant start = Instant.parse("2026-07-12T00:00:00Z");

        assertThatThrownBy(() -> resolver.resolve(
                start,
                start,
                List.of(
                        new LiveTimelineResolver.TimelineItem(10L, 10_000),
                        new LiveTimelineResolver.TimelineItem(20L, -1))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("直播文案时长必须大于零");
    }

    @Test
    void rejectsZeroItemDuration() {
        Instant start = Instant.parse("2026-07-12T00:00:00Z");

        assertThatThrownBy(() -> resolver.resolve(
                start,
                start,
                List.of(new LiveTimelineResolver.TimelineItem(10L, 0))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("直播文案时长必须大于零");
    }

    @Test
    void rejectsTotalDurationOverflow() {
        Instant start = Instant.parse("2026-07-12T00:00:00Z");

        assertThatThrownBy(() -> resolver.resolve(
                start,
                start,
                List.of(
                        new LiveTimelineResolver.TimelineItem(10L, Long.MAX_VALUE),
                        new LiveTimelineResolver.TimelineItem(20L, 1))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("直播文案总时长超出范围");
    }

    @Test
    void clampsExtremeTimeBeforePublishToStart() {
        LiveTimelineResolver.Position position = resolver.resolve(
                Instant.MAX,
                Instant.MIN,
                timeline());

        assertThat(position).isEqualTo(new LiveTimelineResolver.Position(10L, 0, 0, 0, 30_000));
    }

    @Test
    void resolvesExtremeFutureTimeWithoutMillisecondOverflow() {
        LiveTimelineResolver.Position position = resolver.resolve(
                Instant.MIN,
                Instant.MAX,
                timeline());

        assertThat(position).isEqualTo(new LiveTimelineResolver.Position(20L, 1, 19_999, 29_999, 30_000));
    }

    private List<LiveTimelineResolver.TimelineItem> timeline() {
        return List.of(
                new LiveTimelineResolver.TimelineItem(10L, 10_000),
                new LiveTimelineResolver.TimelineItem(20L, 20_000));
    }
}
