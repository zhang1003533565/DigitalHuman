package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.service.MaxKbService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/knowledge")
public class AdminKnowledgeController {

    private final MaxKbService maxKbService;

    public AdminKnowledgeController(MaxKbService maxKbService) {
        this.maxKbService = maxKbService;
    }

    @GetMapping("/open-api/docs")
    public JsonNode docs() {
        return maxKbService.docs();
    }

    @GetMapping("/open-api/config")
    public JsonNode currentConfig() {
        return maxKbService.currentConfig();
    }

    @PostMapping("/open-api/config")
    public JsonNode saveConfig(@RequestBody Map<String, Object> payload) {
        return maxKbService.saveConfig(payload);
    }

    @GetMapping("/knowledges")
    public JsonNode listKnowledges(@RequestParam Map<String, String> query) {
        return maxKbService.listKnowledges(query);
    }

    @GetMapping("/knowledges/{knowledgeId}")
    public JsonNode getKnowledge(@PathVariable String knowledgeId) {
        return maxKbService.getKnowledge(knowledgeId);
    }

    @GetMapping("/knowledges/{knowledgeId}/documents")
    public JsonNode listDocuments(@PathVariable String knowledgeId, @RequestParam Map<String, String> query) {
        return maxKbService.listDocuments(knowledgeId, query);
    }

    @GetMapping("/knowledges/{knowledgeId}/documents/{documentId}/paragraphs")
    public JsonNode listParagraphs(
            @PathVariable String knowledgeId,
            @PathVariable String documentId,
            @RequestParam Map<String, String> query) {
        return maxKbService.listParagraphs(knowledgeId, documentId, query);
    }

    @GetMapping("/assets")
    public ResponseEntity<byte[]> proxyAsset(@RequestParam String path) {
        return maxKbService.proxyAsset(path);
    }

    @GetMapping("/knowledges/{knowledgeId}/documents/{documentId}/paragraphs/{paragraphId}/problems")
    public JsonNode listParagraphProblems(
            @PathVariable String knowledgeId,
            @PathVariable String documentId,
            @PathVariable String paragraphId) {
        return maxKbService.listParagraphProblems(knowledgeId, documentId, paragraphId);
    }

    @PutMapping("/knowledges/{knowledgeId}/documents/{documentId}/paragraphs/{paragraphId}")
    public JsonNode updateParagraph(
            @PathVariable String knowledgeId,
            @PathVariable String documentId,
            @PathVariable String paragraphId,
            @RequestBody Map<String, Object> payload) {
        return maxKbService.updateParagraph(knowledgeId, documentId, paragraphId, payload);
    }

    @PostMapping("/hit-test")
    public JsonNode hitTest(@RequestBody Map<String, Object> payload) {
        return maxKbService.hitTest(payload);
    }
}
