package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.ScenicFacility;
import com.digitalhuman.backend_java.model.ScenicFacilityDetail;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

@Service
public class ScenicKnowledgeDocumentRenderer {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    public RenderedDocument render(ScenicFacility facility, ScenicFacilityDetail detail) {
        String markdown = buildMarkdown(facility, detail);
        return new RenderedDocument(
                "scenic-facility-" + facility.getId() + ".md",
                markdown,
                sha256(markdown),
                detail == null || detail.getContentVersion() == null ? 1 : detail.getContentVersion());
    }

    private String buildMarkdown(ScenicFacility facility, ScenicFacilityDetail detail) {
        StringBuilder builder = new StringBuilder();
        appendTitle(builder, normalize(facility.getName()));
        appendBullet(builder, "景点 ID", facility.getId() == null ? null : String.valueOf(facility.getId()));
        appendBullet(builder, "景点编码", facility.getSpotCode());
        appendBullet(builder, "分类", facility.getCategory() == null ? null : facility.getCategory().getName());
        appendBullet(builder, "位置", facility.getLocationDescription());
        if (facility.getLongitude() != null && facility.getLatitude() != null) {
            appendBullet(builder, "地图坐标", facility.getLongitude().toPlainString() + ", " + facility.getLatitude().toPlainString());
        }
        appendBullet(builder, "开放时间", formatOpenHours(facility.getOpenTime(), facility.getCloseTime()));
        appendBullet(builder, "内容版本", String.valueOf(detail == null || detail.getContentVersion() == null ? 1 : detail.getContentVersion()));

        appendSection(builder, "简介", facility.getShortDescription());
        appendSection(builder, "建筑景观参数", detail == null ? null : detail.getArchitectureLandscapeParams());
        appendSection(builder, "核心功能", detail == null ? null : detail.getCoreFunction());
        appendSection(builder, "文化内涵", detail == null ? null : detail.getCulturalConnotation());
        appendSection(builder, "详细介绍", detail == null ? null : detail.getDetailedIntroduction());
        appendSection(builder, "游玩亮点", detail == null ? null : detail.getHighlights());
        appendSection(builder, "演艺与开放信息", detail == null ? null : detail.getPerformanceOpenInfo());
        appendSection(builder, "游客须知", detail == null ? null : detail.getVisitorNotes());
        appendSection(builder, "备注", detail == null ? null : detail.getRemark());

        return builder.toString();
    }

    private void appendTitle(StringBuilder builder, String title) {
        builder.append("# ").append(title == null ? "未命名景点" : title).append("\n\n");
    }

    private void appendBullet(StringBuilder builder, String label, String value) {
        String normalized = normalize(value);
        if (normalized == null) {
            return;
        }
        builder.append("- ").append(label).append("：").append(normalized).append("\n");
    }

    private void appendSection(StringBuilder builder, String title, String value) {
        String normalized = normalize(value);
        if (normalized == null) {
            return;
        }
        builder.append("\n## ").append(title).append("\n\n")
                .append(normalized)
                .append("\n");
    }

    private String formatOpenHours(LocalTime openTime, LocalTime closeTime) {
        if (openTime == null && closeTime == null) {
            return null;
        }
        String open = openTime == null ? "未知" : TIME_FORMATTER.format(openTime);
        String close = closeTime == null ? "未知" : TIME_FORMATTER.format(closeTime);
        return open + " - " + close;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String sha256(String markdown) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(markdown.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte item : digest) {
                builder.append(String.format("%02x", item));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    public record RenderedDocument(String fileName, String markdown, String sha256, int contentVersion) {
    }
}
