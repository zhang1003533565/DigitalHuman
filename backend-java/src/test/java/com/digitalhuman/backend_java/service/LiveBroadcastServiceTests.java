package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.LiveBroadcastVersion;
import com.digitalhuman.backend_java.model.LiveBroadcastVersionItem;
import com.digitalhuman.backend_java.model.LiveScriptItem;
import com.digitalhuman.backend_java.repository.LiveBroadcastVersionItemRepository;
import com.digitalhuman.backend_java.repository.LiveBroadcastVersionRepository;
import com.digitalhuman.backend_java.repository.LiveScriptItemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class LiveBroadcastServiceTests {
    private final LiveScriptItemRepository drafts = mock(LiveScriptItemRepository.class);
    private final LiveBroadcastVersionRepository versions = mock(LiveBroadcastVersionRepository.class);
    private final LiveBroadcastVersionItemRepository snapshots = mock(LiveBroadcastVersionItemRepository.class);
    private final Instant now = Instant.parse("2026-07-12T04:00:05Z");
    private final LiveBroadcastService service = new LiveBroadcastService(
            drafts, versions, snapshots, new LiveTimelineResolver(), Clock.fixed(now, ZoneOffset.UTC));

    @Test
    void publishRejectsEmptyEnabledDrafts() {
        when(drafts.findAll()).thenReturn(List.of());
        ResponseStatusException error = assertThrows(ResponseStatusException.class, service::publish);
        assertEquals(400, error.getStatusCode().value());
        verifyNoInteractions(versions, snapshots);
    }

    @Test
    void publishFreezesEnabledDraftsInSortOrderAndSumsDuration() {
        LiveScriptItem second = draft(2L, "second", "B", 3000L, 1, true);
        LiveScriptItem first = draft(1L, "first", "A", 2000L, 1, true);
        LiveScriptItem disabled = draft(3L, "off", "C", 9000L, 0, false);
        when(drafts.findAll()).thenReturn(List.of(second, disabled, first));
        when(versions.save(any())).thenAnswer(invocation -> {
            LiveBroadcastVersion value = invocation.getArgument(0); value.setId(10L); return value;
        });
        when(snapshots.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.publish();

        assertEquals(5000L, result.totalDurationMs());
        assertEquals(2, result.itemCount());
        @SuppressWarnings("unchecked") var captor = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(snapshots).saveAll(captor.capture());
        List<LiveBroadcastVersionItem> frozen = captor.getValue();
        assertEquals(List.of(1L, 2L), frozen.stream().map(LiveBroadcastVersionItem::getSourceItemId).toList());
        first.setContent("changed");
        assertEquals("A", frozen.get(0).getContent());
    }

    @Test
    void visitorStatusUsesInjectedClockAndPublishedSnapshot() {
        LiveBroadcastVersion version = new LiveBroadcastVersion();
        version.setId(10L); version.setPublishedAt(Instant.parse("2026-07-12T04:00:00Z"));
        version.setTotalDurationMs(7000L); version.setItemCount(2);
        when(versions.findFirstByOrderByPublishedAtDescIdDesc()).thenReturn(Optional.of(version));
        when(snapshots.findByVersionIdOrderBySortOrderAscIdAsc(10L)).thenReturn(List.of(
                snapshot(101L, 1L, "A", 3000L, 0), snapshot(102L, 2L, "B", 4000L, 1)));

        var status = service.getVisitorStatus();

        assertEquals(now, status.serverTime());
        assertEquals(2L, status.currentItemId());
        assertEquals(1, status.currentItemIndex());
        assertEquals(2000L, status.currentItemOffsetMs());
        assertEquals(5000L, status.cycleOffsetMs());
        assertEquals(1L, status.items().get(0).itemId());
    }

    private LiveScriptItem draft(Long id, String title, String content, Long duration, int order, boolean enabled) {
        LiveScriptItem item = new LiveScriptItem(); item.setId(id); item.setTitle(title); item.setContent(content);
        item.setDurationMs(duration); item.setSortOrder(order); item.setEnabled(enabled); return item;
    }
    private LiveBroadcastVersionItem snapshot(Long id, Long sourceId, String title, long duration, int order) {
        LiveBroadcastVersionItem item = new LiveBroadcastVersionItem(); item.setId(id); item.setVersionId(10L);
        item.setSourceItemId(sourceId); item.setTitle(title); item.setContent(title); item.setDurationMs(duration); item.setSortOrder(order); return item;
    }
}
