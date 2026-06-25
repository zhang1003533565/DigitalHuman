package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.TravelTipDto;
import com.digitalhuman.backend_java.dto.TravelTipSaveRequest;
import com.digitalhuman.backend_java.service.TravelTipService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/travel-tips")
public class AdminTravelTipController {

    private final TravelTipService travelTipService;

    public AdminTravelTipController(TravelTipService travelTipService) {
        this.travelTipService = travelTipService;
    }

    @GetMapping
    public List<TravelTipDto> getAllTips() {
        return travelTipService.getAllTips();
    }

    @GetMapping("/{id}")
    public TravelTipDto getTip(@PathVariable String id) {
        return travelTipService.getTip(id);
    }

    @PostMapping
    public TravelTipDto createTip(@Valid @RequestBody TravelTipSaveRequest request) {
        return travelTipService.saveTip(request);
    }

    @PutMapping("/{id}")
    public TravelTipDto updateTip(@PathVariable String id, @Valid @RequestBody TravelTipSaveRequest request) {
        request.setId(id);
        return travelTipService.saveTip(request);
    }

    @DeleteMapping("/{id}")
    public void deleteTip(@PathVariable String id) {
        travelTipService.deleteTip(id);
    }
}
