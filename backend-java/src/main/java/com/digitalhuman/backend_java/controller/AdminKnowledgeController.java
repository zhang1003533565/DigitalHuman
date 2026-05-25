package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.KnowledgeDocumentDto;
import com.digitalhuman.backend_java.dto.KnowledgeBuildRequest;
import com.digitalhuman.backend_java.dto.KnowledgeBuildResponse;
import com.digitalhuman.backend_java.dto.KnowledgeChunkDto;
import com.digitalhuman.backend_java.dto.KnowledgeDeleteResponse;
import com.digitalhuman.backend_java.dto.KnowledgeUploadResponse;
import com.digitalhuman.backend_java.dto.KnowledgeBuildTaskDto;
import com.digitalhuman.backend_java.service.KnowledgeBaseService;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/knowledge")
public class AdminKnowledgeController {

    private final KnowledgeBaseService knowledgeBaseService;

    public AdminKnowledgeController(KnowledgeBaseService knowledgeBaseService) {
        this.knowledgeBaseService = knowledgeBaseService;
    }

    @GetMapping("/documents")
    public List<KnowledgeDocumentDto> listDocuments() {
        return knowledgeBaseService.listDocuments();
    }

    @PostMapping("/documents/upload")
    public KnowledgeUploadResponse uploadDocument(@RequestParam("file") MultipartFile file) {
        return knowledgeBaseService.uploadDocument(file);
    }

    @PostMapping("/build")
    public KnowledgeBuildResponse buildKnowledgeBase(@RequestBody(required = false) KnowledgeBuildRequest request) {
        return knowledgeBaseService.buildKnowledgeBase(request);
    }

    @PostMapping("/build-tasks")
    public KnowledgeBuildTaskDto submitBuildTask(@RequestBody(required = false) KnowledgeBuildRequest request) {
        return knowledgeBaseService.submitBuildTask(request);
    }

    @GetMapping("/build-tasks")
    public List<KnowledgeBuildTaskDto> listBuildTasks() {
        return knowledgeBaseService.listBuildTasks();
    }

    @PostMapping("/build-tasks/{id}/retry")
    public KnowledgeBuildTaskDto retryBuildTask(@PathVariable Long id) {
        return knowledgeBaseService.retryBuildTask(id);
    }

    @PostMapping("/build-tasks/{id}/cancel")
    public KnowledgeBuildTaskDto cancelBuildTask(@PathVariable Long id) {
        return knowledgeBaseService.cancelBuildTask(id);
    }

    @PostMapping("/documents/{fileName}/rebuild")
    public KnowledgeBuildResponse rebuildDocument(@PathVariable String fileName) {
        return knowledgeBaseService.rebuildDocument(fileName);
    }

    @DeleteMapping("/documents/{fileName}")
    public KnowledgeDeleteResponse deleteDocument(@PathVariable String fileName) {
        return knowledgeBaseService.deleteDocument(fileName);
    }

    @GetMapping("/documents/{fileName}/chunks")
    public KnowledgeChunkDto listDocumentChunks(@PathVariable String fileName) {
        return knowledgeBaseService.listDocumentChunks(fileName);
    }

    @GetMapping("/documents/{fileName}/preview")
    public JsonNode previewDocument(@PathVariable String fileName) {
        return knowledgeBaseService.previewDocument(fileName);
    }

    @GetMapping("/documents/{fileName}/diff")
    public JsonNode diffDocument(@PathVariable String fileName) {
        return knowledgeBaseService.diffDocument(fileName);
    }

    @GetMapping("/documents/{fileName}/versions")
    public JsonNode listDocumentVersions(@PathVariable String fileName) {
        return knowledgeBaseService.listDocumentVersions(fileName);
    }

    @PostMapping("/documents/{fileName}/versions/{version}/restore")
    public JsonNode restoreDocumentVersion(@PathVariable String fileName, @PathVariable String version) {
        return knowledgeBaseService.restoreDocumentVersion(fileName, version);
    }

    @PutMapping("/chunks/{chunkId}/disabled")
    public JsonNode setChunkDisabled(@PathVariable String chunkId, @RequestBody JsonNode request) {
        return knowledgeBaseService.setChunkDisabled(chunkId, request.path("disabled").asBoolean());
    }
}
