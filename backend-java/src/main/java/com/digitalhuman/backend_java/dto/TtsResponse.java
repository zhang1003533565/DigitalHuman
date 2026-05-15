package com.digitalhuman.backend_java.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TtsResponse {

    private boolean success;
    private String fileName;
    private String filePath;
    private String message;
    private Long durationMs;

    public static TtsResponse success(String fileName, String filePath, Long durationMs) {
        return TtsResponse.builder()
                .success(true)
                .fileName(fileName)
                .filePath(filePath)
                .durationMs(durationMs)
                .message("TTS conversion successful")
                .build();
    }

    public static TtsResponse error(String message) {
        return TtsResponse.builder()
                .success(false)
                .message(message)
                .build();
    }
}
