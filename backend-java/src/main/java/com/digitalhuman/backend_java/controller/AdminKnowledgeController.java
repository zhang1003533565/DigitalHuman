package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.KnowledgeDocumentDto;
import com.digitalhuman.backend_java.dto.KnowledgeUploadResponse;
import com.digitalhuman.backend_java.service.KnowledgeBaseService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
}
