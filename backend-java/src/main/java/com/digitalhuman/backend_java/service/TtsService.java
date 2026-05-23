package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TtsRequest;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class TtsService {

    private static final Logger log = LoggerFactory.getLogger(TtsService.class);

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    @Value("${tts.edge-service-url}")
    private String edgeServiceUrl;

    @Value("${tts.output-dir:tts}")
    private String outputDir;

    private final OkHttpClient client;
    private final ObjectMapper objectMapper;

    public TtsService() {
        this.client = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
        this.objectMapper = new ObjectMapper();
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

    public List<String> listVoices() throws Exception {
        Request request = new Request.Builder()
                .url(edgeServiceUrl + "/voices")
                .get()
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("Voice list request failed: " + response.code());
            }

            Map<String, Object> payload = objectMapper.readValue(response.body().string(), new TypeReference<>() {});
            Object voicesObj = payload.get("voices");
            if (!(voicesObj instanceof List<?> voices)) {
                throw new IOException("Voice list payload is invalid");
            }

            return voices.stream()
                    .filter(Map.class::isInstance)
                    .map(Map.class::cast)
                    .map(item -> item.get("ShortName"))
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .sorted()
                    .toList();
        }
    }

    private void ensureOutputDirectory() {
        File dir = new File(outputDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }
    }
}
