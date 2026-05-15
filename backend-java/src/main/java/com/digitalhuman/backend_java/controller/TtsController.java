package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.TtsRequest;
import com.digitalhuman.backend_java.dto.TtsResponse;
import com.digitalhuman.backend_java.service.TtsService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/tts")
public class TtsController {

    @Autowired
    private TtsService ttsService;

    @Value("${tts.output-dir:tts}")
    private String outputDir;

    @Value("${tts.base-url:http://localhost:8080}")
    private String baseUrl;

    @PostMapping("/synthesize")
    public ResponseEntity<TtsResponse> synthesize(@Valid @RequestBody TtsRequest request) {
        if (!ttsService.isServiceAvailable()) {
            return ResponseEntity.internalServerError()
                    .body(TtsResponse.error("Edge TTS Python service is not running. Please start ai-service/edge_tts_service.py first."));
        }

        try {
            long startTime = System.currentTimeMillis();
            String filePath = ttsService.synthesize(request);
            long duration = System.currentTimeMillis() - startTime;

            File file = new File(filePath);
            String fileName = file.getName();

            TtsResponse response = TtsResponse.success(
                    fileName,
                    baseUrl + "/api/tts/audio/" + fileName,
                    duration
            );

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(TtsResponse.error("TTS conversion failed: " + e.getMessage()));
        }
    }

    @GetMapping("/audio/{fileName}")
    public ResponseEntity<Resource> getAudio(@PathVariable String fileName) {
        File file = new File(outputDir, fileName);
        if (!file.exists()) {
            return ResponseEntity.notFound().build();
        }

        Resource resource = new FileSystemResource(file);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("audio/mpeg"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                .body(resource);
    }

    @GetMapping("/voices")
    public ResponseEntity<Map<String, String>> getAvailableVoices() {
        Map<String, String> voices = new HashMap<>();
        voices.put("xiaoxiao", "zh-CN-XiaoxiaoNeural");
        voices.put("xiaoyi", "zh-CN-XiaoyiNeural");
        voices.put("yunjian", "zh-CN-YunjianNeural");
        voices.put("yunxi", "zh-CN-YunxiNeural");
        voices.put("yunxia", "zh-CN-YunxiaNeural");
        voices.put("yunyang", "zh-CN-YunyangNeural");
        voices.put("xiaobei", "zh-CN-XiaobeiNeural");
        voices.put("xiaoni", "zh-CN-XiaoniNeural");
        voices.put("hiugaai", "zh-HK-HiuGaaiNeural");
        voices.put("hiumaan", "zh-HK-HiuMaanNeural");
        voices.put("wanlung", "zh-HK-WanLungNeural");
        voices.put("xiaochou", "zh-TW-XiaoChouNeural");
        voices.put("hsiaochen", "zh-TW-HsiaoChenNeural");
        voices.put("hsiaoyu", "zh-TW-HsiaoYuNeural");
        voices.put("yunjhe", "zh-TW-YunJheNeural");
        voices.put("en_us_jenny", "en-US-JennyNeural");
        voices.put("en_us_guy", "en-US-GuyNeural");
        voices.put("en_us_aria", "en-US-AriaNeural");

        return ResponseEntity.ok(voices);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> status = new HashMap<>();
        boolean edgeServiceRunning = ttsService.isServiceAvailable();
        status.put("status", edgeServiceRunning ? "ok" : "degraded");
        status.put("edge_tts_service", edgeServiceRunning ? "running" : "not_running");
        status.put("message", edgeServiceRunning ? "All services healthy" : "Edge TTS Python service needs to be started");
        return ResponseEntity.ok(status);
    }
}
