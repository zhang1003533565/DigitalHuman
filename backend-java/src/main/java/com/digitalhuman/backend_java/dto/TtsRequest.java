package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TtsRequest {

    @NotBlank(message = "Text cannot be empty")
    private String text;

    private String voice;

    @Builder.Default
    private String rate = "+0%";

    @Builder.Default
    private String volume = "+0%";

    @Builder.Default
    private String pitch = "+0Hz";

    @Builder.Default
    private String outputFileName = null;

    public String getVoice() {
        if (voice == null || voice.isEmpty()) {
            return "zh-CN-XiaoxiaoNeural";
        }
        return voice;
    }
}
