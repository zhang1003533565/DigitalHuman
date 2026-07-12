package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.VisitorLiveStatusDto;
import com.digitalhuman.backend_java.service.LiveBroadcastService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user/live")
public class UserLiveBroadcastController {
    private final LiveBroadcastService service;
    public UserLiveBroadcastController(LiveBroadcastService service) { this.service = service; }
    @GetMapping("/status") public VisitorLiveStatusDto status() { return service.getVisitorStatus(); }
}
