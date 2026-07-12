package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.*;
import com.digitalhuman.backend_java.service.LiveBroadcastService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/live-broadcast")
public class AdminLiveBroadcastController {
    private final LiveBroadcastService service;
    public AdminLiveBroadcastController(LiveBroadcastService service) { this.service = service; }
    @GetMapping("/items") public List<LiveScriptItemDto> items() { return service.listItems(); }
    @PostMapping("/items") public LiveScriptItemDto create(@Valid @RequestBody LiveScriptItemRequest request) { return service.create(request); }
    @PutMapping("/items/{id}") public LiveScriptItemDto update(@PathVariable Long id, @Valid @RequestBody LiveScriptItemRequest request) { return service.update(id, request); }
    @DeleteMapping("/items/{id}") public void delete(@PathVariable Long id) { service.delete(id); }
    @PutMapping("/items/reorder") public List<LiveScriptItemDto> reorder(@RequestBody List<Long> ids) { return service.reorder(ids); }
    @PostMapping("/publish") public LivePublishSummaryDto publish() { return service.publish(); }
    @GetMapping("/published") public LivePublishSummaryDto published() { return service.getPublished(); }
}
