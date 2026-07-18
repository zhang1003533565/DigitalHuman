package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.ScenicStructuredImportResponse;
import com.digitalhuman.backend_java.dto.ScenicStructuredImportResult;
import com.digitalhuman.backend_java.dto.ScenicMediaUploadResponse;
import com.digitalhuman.backend_java.dto.ScenicStructuredSpotRecordRequest;
import com.digitalhuman.backend_java.model.ScenicStructuredSpotRecord;
import com.digitalhuman.backend_java.service.ScenicMediaService;
import com.digitalhuman.backend_java.service.ScenicStructuredSpotService;
import jakarta.validation.Valid;
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

import java.util.List;

@RestController
@RequestMapping("/api/admin/scenic-structured")
public class AdminScenicStructuredController {

    private final ScenicStructuredSpotService service;
    private final ScenicMediaService mediaService;

    public AdminScenicStructuredController(ScenicStructuredSpotService service, ScenicMediaService mediaService) {
        this.service = service;
        this.mediaService = mediaService;
    }

    @GetMapping("/records")
    public List<ScenicStructuredSpotRecord> listRecords() {
        return service.listAll();
    }

    @GetMapping("/records/{id}")
    public ScenicStructuredSpotRecord getRecord(@PathVariable Long id) {
        return service.getById(id);
    }

    @PostMapping("/records")
    public ScenicStructuredSpotRecord createRecord(@Valid @RequestBody ScenicStructuredSpotRecordRequest request) {
        return service.createRecord(request);
    }

    @PutMapping("/records/{id}")
    public ScenicStructuredSpotRecord updateRecord(@PathVariable Long id, @Valid @RequestBody ScenicStructuredSpotRecordRequest request) {
        return service.updateRecord(id, request);
    }

    @DeleteMapping("/records/{id}")
    public void deleteRecord(@PathVariable Long id) {
        service.deleteRecord(id);
    }

    @GetMapping("/template")
    public ResponseEntity<byte[]> downloadTemplate() {
        byte[] bytes = service.buildTemplateFile();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
        headers.setContentDisposition(ContentDisposition.attachment().filename("scenic_structured_template.docx").build());
        return ResponseEntity.ok().headers(headers).body(bytes);
    }

    @PostMapping("/import")
    public ScenicStructuredImportResponse importRecords(
            @RequestParam("file") MultipartFile file,
            @RequestParam(name = "replaceAll", defaultValue = "false") boolean replaceAll) {
        ScenicStructuredImportResult result = service.importFromDocx(file, replaceAll);
        int total = service.listAll().size();
        return new ScenicStructuredImportResponse(
                result.getImportedCount(),
                total,
                result.getSkippedEmptyCount(),
                result.getSkippedDuplicateCount(),
                result.getIssues());
    }

    @PostMapping(value = "/media/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ScenicMediaUploadResponse uploadLiveVideo(@RequestParam("file") MultipartFile file) {
        return mediaService.uploadVideo(file);
    }
}
