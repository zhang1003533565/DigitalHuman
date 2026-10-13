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

    @Test
    void uploadsProductImageWithRandomizedPublicPath() throws Exception {
        ScenicMediaService service = new ScenicMediaService(tempDir.toString());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "noodle.png",
                "image/png",
                new byte[]{9, 8, 7}
        );

        ScenicMediaUploadResponse response = service.uploadImage(file);

        assertTrue(response.fileName().endsWith(".png"));
        assertEquals("/api/scenic-media/" + response.fileName(), response.url());
        assertTrue(Files.exists(tempDir.resolve(response.fileName())));
    }

    @Test
    void acceptsJpegWebpAndJpgForProductImages() throws Exception {
        ScenicMediaService service = new ScenicMediaService(tempDir.toString());

        for (String name : new String[]{"a.jpg", "b.jpeg", "c.webp"}) {
            MockMultipartFile file = new MockMultipartFile("file", name, "image/jpeg", new byte[]{1});
            ScenicMediaUploadResponse response = service.uploadImage(file);
            assertTrue(response.fileName().endsWith(name.substring(name.lastIndexOf('.'))));
        }
    }

    @Test
    void rejectsNonImageExtensionForProductImages() {
        ScenicMediaService service = new ScenicMediaService(tempDir.toString());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "clip.mp4",
                "video/mp4",
                new byte[]{1}
        );

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.uploadImage(file)
        );

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    void rejectsImageExtensionWithNonImageContentType() {
        ScenicMediaService service = new ScenicMediaService(tempDir.toString());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "fake.png",
                "application/octet-stream",
                new byte[]{1}
        );

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.uploadImage(file)
        );

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    void rejectsEmptyImageUpload() {
        ScenicMediaService service = new ScenicMediaService(tempDir.toString());
        MockMultipartFile file = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.uploadImage(file)
        );

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    void videoUploadStillRejectsImagesAfterImageSupportWasAdded() {
        ScenicMediaService service = new ScenicMediaService(tempDir.toString());
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", new byte[]{1});

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.uploadVideo(file)
        );

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }
}
