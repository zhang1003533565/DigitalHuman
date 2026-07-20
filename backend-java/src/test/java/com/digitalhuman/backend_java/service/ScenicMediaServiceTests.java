package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicMediaUploadResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ScenicMediaServiceTests {

    @TempDir
    Path tempDir;

    @Test
    void uploadsVideoWithRandomizedPublicPath() throws Exception {
        ScenicMediaService service = new ScenicMediaService(tempDir.toString());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "intro.mp4",
                "video/mp4",
                new byte[]{1, 2, 3}
        );

        ScenicMediaUploadResponse response = service.uploadVideo(file);

        assertTrue(response.fileName().endsWith(".mp4"));
        assertEquals("/api/scenic-media/" + response.fileName(), response.url());
        assertTrue(Files.exists(tempDir.resolve(response.fileName())));
    }

    @Test
    void rejectsNonVideoFileExtensions() {
        ScenicMediaService service = new ScenicMediaService(tempDir.toString());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "notes.txt",
                "text/plain",
                "not a video".getBytes()
        );

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.uploadVideo(file)
        );

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    void resolvesDefaultMediaDirectoryFromRepositoryRoot() throws Exception {
        Files.createDirectories(tempDir.resolve("backend-java"));

        Path resolved = ScenicMediaService.resolveMediaRoot("", tempDir);

        assertEquals(tempDir.resolve("backend-java/media/scenic"), resolved);
    }

    @Test
    void resolvesDefaultMediaDirectoryFromBackendModule() throws Exception {
        Files.createDirectories(tempDir.resolve("src/main/java"));

        Path resolved = ScenicMediaService.resolveMediaRoot("", tempDir);

        assertEquals(tempDir.resolve("media/scenic"), resolved);
    }

    @Test
    void keepsExplicitMediaDirectory() {
        Path configured = tempDir.resolve("configured-media");

        Path resolved = ScenicMediaService.resolveMediaRoot(configured.toString(), tempDir.resolve("ignored"));

        assertEquals(configured, resolved);
    }
}
