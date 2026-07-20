package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicMediaUploadResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ScenicMediaService {

    private static final Set<String> VIDEO_EXTENSIONS = Set.of(".mp4", ".webm", ".mov", ".m4v");
    private final Path mediaRoot;

    public ScenicMediaService(@Value("${scenic.media-dir:}") String mediaDir) {
        this.mediaRoot = resolveMediaRoot(mediaDir, Path.of("").toAbsolutePath());
    }

    public String resourceLocation() {
        return mediaRoot.toUri().toString();
    }

    static Path resolveMediaRoot(String configuredMediaDir, Path workingDirectory) {
        if (configuredMediaDir != null && !configuredMediaDir.isBlank()) {
            return Path.of(configuredMediaDir).toAbsolutePath().normalize();
        }
        Path current = workingDirectory.toAbsolutePath().normalize();
        if (Files.isDirectory(current.resolve("src/main"))) {
            return current.resolve("media/scenic");
        }
        if (Files.isDirectory(current.resolve("backend-java"))) {
            return current.resolve("backend-java/media/scenic");
        }
        return current.resolve("media/scenic");
    }

    public ScenicMediaUploadResponse uploadVideo(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw badRequest("上传视频不能为空");
        }
        String extension = extensionOf(file.getOriginalFilename());
        if (!VIDEO_EXTENSIONS.contains(extension)) {
            throw badRequest("仅支持 MP4、WebM、MOV 或 M4V 视频");
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank() && !contentType.toLowerCase(Locale.ROOT).startsWith("video/")) {
            throw badRequest("上传文件不是有效的视频类型");
        }

        String fileName = UUID.randomUUID() + extension;
        Path target = mediaRoot.resolve(fileName).normalize();
        if (!target.startsWith(mediaRoot)) {
            throw badRequest("视频文件名不合法");
        }
        try {
            Files.createDirectories(mediaRoot);
            file.transferTo(target);
            return new ScenicMediaUploadResponse(fileName, "/api/scenic-media/" + fileName);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "保存直播视频失败", exception);
        }
    }

    private String extensionOf(String fileName) {
        String normalized = fileName == null ? "" : fileName.trim().toLowerCase(Locale.ROOT);
        int dot = normalized.lastIndexOf('.');
        return dot < 0 ? "" : normalized.substring(dot);
    }

    private ResponseStatusException badRequest(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
