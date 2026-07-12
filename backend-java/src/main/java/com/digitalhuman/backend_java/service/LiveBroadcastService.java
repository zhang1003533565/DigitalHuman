package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.*;
import com.digitalhuman.backend_java.model.*;
import com.digitalhuman.backend_java.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Service
public class LiveBroadcastService {
    private final LiveScriptItemRepository drafts;
    private final LiveBroadcastVersionRepository versions;
    private final LiveBroadcastVersionItemRepository snapshots;
    private final LiveTimelineResolver timelineResolver;
    private final Clock clock;

    public LiveBroadcastService(LiveScriptItemRepository drafts, LiveBroadcastVersionRepository versions,
                                LiveBroadcastVersionItemRepository snapshots, LiveTimelineResolver timelineResolver,
                                Clock clock) {
        this.drafts = drafts; this.versions = versions; this.snapshots = snapshots;
        this.timelineResolver = timelineResolver; this.clock = clock;
    }

    public List<LiveScriptItemDto> listItems() {
        return drafts.findAll().stream().sorted(Comparator.comparing(LiveScriptItem::getSortOrder)
                .thenComparing(LiveScriptItem::getId)).map(this::draftDto).toList();
    }

    public LiveScriptItemDto create(LiveScriptItemRequest request) {
        LiveScriptItem item = new LiveScriptItem(); apply(item, request);
        if (item.getSortOrder() == null) item.setSortOrder(drafts.findAll().size());
        if (item.getEnabled() == null) item.setEnabled(true);
        return draftDto(drafts.save(item));
    }

    public LiveScriptItemDto update(Long id, LiveScriptItemRequest request) {
        LiveScriptItem item = draft(id); apply(item, request);
        if (item.getSortOrder() == null) item.setSortOrder(0);
        if (item.getEnabled() == null) item.setEnabled(true);
        return draftDto(drafts.save(item));
    }

    public void delete(Long id) {
        if (!drafts.existsById(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "直播文案不存在");
        drafts.deleteById(id);
    }

    @Transactional
    public List<LiveScriptItemDto> reorder(List<Long> ids) {
        if (ids == null || ids.size() != drafts.count() || ids.stream().distinct().count() != ids.size())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "排序必须包含全部且不重复的文案 ID");
        for (int i = 0; i < ids.size(); i++) { LiveScriptItem item = draft(ids.get(i)); item.setSortOrder(i); drafts.save(item); }
        return listItems();
    }

    @Transactional
    public LivePublishSummaryDto publish() {
        List<LiveScriptItem> enabled = drafts.findAll().stream().filter(i -> Boolean.TRUE.equals(i.getEnabled()))
                .sorted(Comparator.comparing(LiveScriptItem::getSortOrder).thenComparing(LiveScriptItem::getId)).toList();
        if (enabled.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "至少需要一条启用的直播文案");
        long total = 0;
        for (LiveScriptItem item : enabled) {
            validate(item); total = Math.addExact(total, item.getDurationMs());
        }
        Instant publishedAt = clock.instant();
        LiveBroadcastVersion version = new LiveBroadcastVersion(); version.setPublishedAt(publishedAt);
        version.setTotalDurationMs(total); version.setItemCount(enabled.size()); version = versions.save(version);
        Long versionId = version.getId();
        List<LiveBroadcastVersionItem> frozen = enabled.stream().map(item -> snapshot(versionId, item)).toList();
        snapshots.saveAll(frozen);
        return new LivePublishSummaryDto(versionId, publishedAt, total, enabled.size());
    }

    public LivePublishSummaryDto getPublished() {
        return versions.findFirstByOrderByPublishedAtDescIdDesc().map(this::summary).orElse(null);
    }

    public VisitorLiveStatusDto getVisitorStatus() {
        Instant serverTime = clock.instant();
        return versions.findFirstByOrderByPublishedAtDescIdDesc().map(version -> {
            List<LiveBroadcastVersionItem> items = snapshots.findByVersionIdOrderBySortOrderAscIdAsc(version.getId());
            var position = timelineResolver.resolve(version.getPublishedAt(), serverTime,
                    items.stream().map(i -> new LiveTimelineResolver.TimelineItem(i.getSourceItemId(), i.getDurationMs())).toList());
            List<VisitorLiveItemDto> dtoItems = items.stream().map(i -> new VisitorLiveItemDto(i.getSourceItemId(), i.getTitle(),
                    i.getContent(), i.getDurationMs(), i.getSortOrder())).toList();
            return new VisitorLiveStatusDto("published", serverTime, version.getId(), version.getPublishedAt(),
                    position.totalDurationMs(), position.itemId(), position.itemIndex(), position.itemOffsetMs(),
                    position.cycleOffsetMs(), dtoItems);
        }).orElseGet(() -> VisitorLiveStatusDto.notPublished(serverTime));
    }

    private void apply(LiveScriptItem item, LiveScriptItemRequest request) {
        item.setTitle(request.title()); item.setContent(request.content()); item.setDurationMs(request.durationMs());
        item.setSortOrder(request.sortOrder()); item.setEnabled(request.enabled());
    }
    private LiveScriptItem draft(Long id) { return drafts.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "直播文案不存在")); }
    private void validate(LiveScriptItem item) {
        if (item.getTitle() == null || item.getTitle().isBlank() || item.getContent() == null || item.getContent().isBlank()
                || item.getDurationMs() == null || item.getDurationMs() < 1000 || item.getDurationMs() > 600000)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "直播文案标题、正文或时长不合法");
    }
    private LiveScriptItemDto draftDto(LiveScriptItem i) { return new LiveScriptItemDto(i.getId(), i.getTitle(), i.getContent(), i.getDurationMs(), i.getSortOrder(), i.getEnabled(), i.getUpdatedAt()); }
    private LivePublishSummaryDto summary(LiveBroadcastVersion v) { return new LivePublishSummaryDto(v.getId(), v.getPublishedAt(), v.getTotalDurationMs(), v.getItemCount()); }
    private LiveBroadcastVersionItem snapshot(Long versionId, LiveScriptItem i) {
        LiveBroadcastVersionItem s = new LiveBroadcastVersionItem(); s.setVersionId(versionId); s.setSourceItemId(i.getId());
        s.setTitle(i.getTitle()); s.setContent(i.getContent()); s.setDurationMs(i.getDurationMs()); s.setSortOrder(i.getSortOrder()); return s;
    }
}
