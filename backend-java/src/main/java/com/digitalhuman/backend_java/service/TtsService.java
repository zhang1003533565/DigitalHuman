package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TtsRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

@Service
public class TtsService {

    private static final Logger log = LoggerFactory.getLogger(TtsService.class);

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    @Value("${tts.edge-service-url:http://127.0.0.1:18754}")
    private String edgeServiceUrl;

    @Value("${tts.edge-script-path:edge_tts_service.py}")
    private String edgeScriptPath;

    @Value("${tts.output-dir:tts}")
    private String outputDir;

    private final OkHttpClient client;
    private final ObjectMapper objectMapper;
    private Process pythonProcess;

    public TtsService() {
        this.client = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
        this.objectMapper = new ObjectMapper();
    }

    @PostConstruct
    public void init() {
        // 延迟启动，等待 Spring Boot 完全启动
        new Thread(() -> {
            try {
                Thread.sleep(2000);
                startPythonService();
            } catch (Exception e) {
                log.error("Failed to start Python TTS service", e);
            }
        }).start();
    }

    @PreDestroy
    public void cleanup() {
        if (pythonProcess != null && pythonProcess.isAlive()) {
            log.info("Stopping Python TTS service...");
            pythonProcess.destroy();
            try {
                pythonProcess.waitFor(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                pythonProcess.destroyForcibly();
            }
        }
    }

    private void startPythonService() {
        if (isServiceAvailable()) {
            log.info("Python TTS service is already running");
            return;
        }

        try {
            log.info("Starting Python TTS service from: {}", edgeScriptPath);

            File scriptFile = new File(edgeScriptPath);
            String workingDir = scriptFile.getParent();
            if (workingDir == null || workingDir.isEmpty()) {
                workingDir = System.getProperty("user.dir");
            }

            ProcessBuilder pb = new ProcessBuilder(
                    "py", "-3.13", edgeScriptPath
            );
            pb.directory(new File(workingDir));
            pb.redirectErrorStream(true);

            pythonProcess = pb.start();

            // 等待服务启动
            int retries = 30;
            while (retries > 0 && !isServiceAvailable()) {
                Thread.sleep(500);
                retries--;

                if (!pythonProcess.isAlive()) {
                    throw new IOException("Python process died unexpectedly");
                }
            }

            if (isServiceAvailable()) {
                log.info("Python TTS service started successfully");
            } else {
                log.warn("Python TTS service may not be fully started yet");
            }
        } catch (Exception e) {
            log.error("Failed to start Python TTS service: {}", e.getMessage());
        }
    }

    public String synthesize(TtsRequest request) throws Exception {
        String outputFileName = request.getOutputFileName();
        if (outputFileName == null || outputFileName.isEmpty()) {
            outputFileName = java.util.UUID.randomUUID().toString() + ".mp3";
        }
        if (!outputFileName.toLowerCase().endsWith(".mp3")) {
            outputFileName += ".mp3";
        }

        ensureOutputDirectory();

        String url = edgeServiceUrl + "/tts";
        String jsonPayload = objectMapper.writeValueAsString(java.util.Map.of(
                "text", request.getText(),
                "voice", request.getVoice() != null ? request.getVoice() : "zh-CN-XiaoxiaoNeural",
                "rate", request.getRate() != null ? request.getRate() : "+0%",
                "volume", request.getVolume() != null ? request.getVolume() : "+0%",
                "pitch", request.getPitch() != null ? request.getPitch() : "+0Hz"
        ));

        RequestBody body = RequestBody.create(jsonPayload, JSON);
        Request httpRequest = new Request.Builder()
                .url(url)
                .post(body)
                .build();

        try (Response response = client.newCall(httpRequest).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("TTS request failed: " + response.code());
            }

            byte[] audioData = response.body().bytes();

            String outputPath = outputDir + File.separator + outputFileName;
            java.nio.file.Files.write(java.nio.file.Paths.get(outputPath), audioData);

            return outputPath;
        }
    }

    public boolean isServiceAvailable() {
        try {
            Request request = new Request.Builder()
                    .url(edgeServiceUrl + "/health")
                    .get()
                    .build();

            try (Response response = client.newCall(request).execute()) {
                return response.isSuccessful();
            }
        } catch (Exception e) {
            return false;
        }
    }

    private void ensureOutputDirectory() {
        File dir = new File(outputDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }
    }
}
