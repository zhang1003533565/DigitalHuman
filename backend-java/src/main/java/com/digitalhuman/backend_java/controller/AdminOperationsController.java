package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.OperationsOverviewDto;
import com.digitalhuman.backend_java.service.OperationsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/operations")
public class AdminOperationsController {
    private final OperationsService operationsService;

    public AdminOperationsController(OperationsService operationsService) {
        this.operationsService = operationsService;
    }

    @GetMapping("/overview")
    public OperationsOverviewDto overview() {
        return operationsService.getOverview();
    }
}
