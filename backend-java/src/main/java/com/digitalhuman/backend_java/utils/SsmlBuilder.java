package com.digitalhuman.backend_java.utils;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SsmlBuilder {

    private String text;
    private String voice;
    private String rate;
    private String volume;
    private String pitch;
    private String locale;

    public String build() {
        StringBuilder ssml = new StringBuilder();
        ssml.append("<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='")
            .append(getLocaleOrDefault())
            .append("' xmlns:mstts='http://schemas.microsoft.com/ms/tts/2012/logical'>")
            .append("<voice name='").append(voice).append("'>");

        String prosodyContent = buildProsodyContent();
        if (hasProsodyAttributes()) {
            ssml.append("<prosody");
            if (rate != null && !rate.isEmpty()) {
                ssml.append(" rate='").append(normalizeRate(rate)).append("'");
            }
            if (volume != null && !volume.isEmpty()) {
                ssml.append(" volume='").append(normalizeVolume(volume)).append("'");
            }
            if (pitch != null && !pitch.isEmpty()) {
                ssml.append(" pitch='").append(normalizePitch(pitch)).append("'");
            }
            ssml.append(">").append(prosodyContent).append("</prosody>");
        } else {
            ssml.append(prosodyContent);
        }

        ssml.append("</voice></speak>");
        return ssml.toString();
    }

    private String buildProsodyContent() {
        if (text == null || text.isEmpty()) {
            return "";
        }
        String content = text;
        content = content.replace("&", "&amp;");
        content = content.replace("<", "&lt;");
        content = content.replace(">", "&gt;");
        content = content.replace("\"", "&quot;");
        content = content.replace("'", "&apos;");
        return content;
    }

    private boolean hasProsodyAttributes() {
        return (rate != null && !rate.isEmpty()) ||
               (volume != null && !volume.isEmpty()) ||
               (pitch != null && !pitch.isEmpty());
    }

    private String getLocaleOrDefault() {
        if (locale != null && !locale.isEmpty()) {
            return locale;
        }
        if (voice != null && voice.contains("-")) {
            String[] parts = voice.split("-");
            return parts[0] + "-" + parts[1];
        }
        return "zh-CN";
    }

    private String normalizeRate(String rate) {
        if (rate == null) return "0%";
        if (rate.matches("^[+-]?\\d+%$")) {
            return rate;
        }
        return rate + "%";
    }

    private String normalizeVolume(String volume) {
        if (volume == null) return "100%";
        if (volume.matches("^[+-]?\\d+%$")) {
            return volume;
        }
        return volume + "%";
    }

    private String normalizePitch(String pitch) {
        if (pitch == null) return "+0Hz";
        if (pitch.matches("^[+-]?\\d+Hz$")) {
            return pitch;
        }
        return pitch + "Hz";
    }
}
