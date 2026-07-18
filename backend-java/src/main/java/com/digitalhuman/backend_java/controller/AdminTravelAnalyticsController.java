package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.TravelAnalyticsImportResponse;
import com.digitalhuman.backend_java.dto.TravelAnalyticsImportResult;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.dto.TravelAnalyticsPageResponse;
import com.digitalhuman.backend_java.dto.TravelAnalyticsRecordRequest;
import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.model.TravelAnalyticsRecord;
import com.digitalhuman.backend_java.model.TravelAnalyticsAiConfig;
import com.digitalhuman.backend_java.service.TravelAnalyticsAiConfigService;
import com.digitalhuman.backend_java.service.TravelAnalyticsMetricService;
import com.digitalhuman.backend_java.service.TravelAnalyticsService;
import org.springframework.data.domain.Page;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin/travel-analytics")
public class AdminTravelAnalyticsController {

    private final TravelAnalyticsService travelAnalyticsService;
    private final TravelAnalyticsMetricService travelAnalyticsMetricService;
    private final TravelAnalyticsAiConfigService travelAnalyticsAiConfigService;

    public AdminTravelAnalyticsController(
            TravelAnalyticsService travelAnalyticsService,
            TravelAnalyticsMetricService travelAnalyticsMetricService,
            TravelAnalyticsAiConfigService travelAnalyticsAiConfigService) {
        this.travelAnalyticsService = travelAnalyticsService;
        this.travelAnalyticsMetricService = travelAnalyticsMetricService;
        this.travelAnalyticsAiConfigService = travelAnalyticsAiConfigService;
    }

    @GetMapping("/records")
    public TravelAnalyticsPageResponse listRecords(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        Page<TravelAnalyticsRecord> result = travelAnalyticsService.listPage(page, size);
        return new TravelAnalyticsPageResponse(
                result.getContent(),
                result.getTotalElements(),
                result.getNumber(),
                result.getSize());
    }

    @GetMapping("/records/{id}")
    public TravelAnalyticsRecord getRecord(@PathVariable Long id) {
        return travelAnalyticsService.getById(id);
    }

    @PostMapping("/records")
    public TravelAnalyticsRecord createRecord(@Valid @RequestBody TravelAnalyticsRecordRequest request) {
        return travelAnalyticsService.createRecord(request);
    }

    @PutMapping("/records/{id}")
    public TravelAnalyticsRecord updateRecord(@PathVariable Long id, @Valid @RequestBody TravelAnalyticsRecordRequest request) {
        return travelAnalyticsService.updateRecord(id, request);
    }

    @DeleteMapping("/records/{id}")
    public void deleteRecord(@PathVariable Long id) {
        travelAnalyticsService.deleteRecord(id);
    }

    @GetMapping("/template")
    public ResponseEntity<byte[]> downloadTemplate() {
        byte[] bytes = travelAnalyticsService.buildTemplateFile();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(ContentDisposition.attachment().filename("travel_analytics_template.xlsx").build());
        return ResponseEntity.ok().headers(headers).body(bytes);
    }

    @PostMapping("/import")
    public TravelAnalyticsImportResponse importRecords(
            @RequestParam("file") MultipartFile file,
            @RequestParam(name = "replaceAll", defaultValue = "false") boolean replaceAll) {
        TravelAnalyticsImportResult result = travelAnalyticsService.importFromExcel(file, replaceAll);
        long total = travelAnalyticsService.countAll();
        return new TravelAnalyticsImportResponse(
                result.getImportedCount(),
                Math.toIntExact(Math.min(total, Integer.MAX_VALUE)),
                result.getSkippedEmptyCount(),
                result.getSkippedDuplicateCount(),
                result.getIssues());
    }

    @GetMapping("/ai-config")
    public TravelAnalyticsAiConfig getAiConfig() {
        return travelAnalyticsAiConfigService.getConfig();
    }

    @PutMapping("/ai-config")
    public TravelAnalyticsAiConfig updateAiConfig(@RequestBody TravelAnalyticsAiConfigUpdateRequest request) {
        return travelAnalyticsAiConfigService.updateConfig(request.publicEnabled(), request.minimumSampleSize());
    }

    @PostMapping("/metrics/{metric}/test")
    public TravelAnalyticsMetricResponse testMetric(@PathVariable TravelAnalyticsMetric metric) {
        return travelAnalyticsMetricService.queryMetric(TravelAnalyticsAudience.ADMIN, metric);
    }

    record TravelAnalyticsAiConfigUpdateRequest(Boolean publicEnabled, Integer minimumSampleSize) {
    }
}
