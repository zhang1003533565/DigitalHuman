package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.KnowledgeDocumentDto;
import com.digitalhuman.backend_java.dto.KnowledgeBuildRequest;
import com.digitalhuman.backend_java.dto.KnowledgeBuildResponse;
import com.digitalhuman.backend_java.dto.KnowledgeChunkDto;
import com.digitalhuman.backend_java.dto.KnowledgeDeleteResponse;
import com.digitalhuman.backend_java.dto.KnowledgeUploadResponse;
import com.digitalhuman.backend_java.dto.KnowledgeBuildTaskDto;
import com.digitalhuman.backend_java.model.KnowledgeBuildTask;
import com.digitalhuman.backend_java.repository.KnowledgeBuildTaskRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.time.LocalDateTime;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class KnowledgeBaseService {

    private static final MediaType OCTET_STREAM = MediaType.get("application/octet-stream");

    @Value("${rag.service-url}")
    private String ragServiceUrl;

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final AuditLogService auditLogService;
    private final KnowledgeBuildTaskRepository taskRepository;
    private final ExecutorService buildExecutor = Executors.newSingleThreadExecutor();

    public KnowledgeBaseService(AuditLogService auditLogService, KnowledgeBuildTaskRepository taskRepository) {
        this.auditLogService = auditLogService;
        this.taskRepository = taskRepository;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(180, TimeUnit.SECONDS)
                .writeTimeout(180, TimeUnit.SECONDS)
                .build();
        this.objectMapper = new ObjectMapper();
    }

    public List<KnowledgeDocumentDto> listDocuments() {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/kb/documents")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("RAG knowledge document list request failed");
            }
            return objectMapper.readValue(response.body().string(), new TypeReference<>() {});
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "知识库服务不可用", exception);
        }
    }

    public KnowledgeUploadResponse uploadDocument(MultipartFile file) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "上传文件不能为空");
        }

        try {
            RequestBody fileBody = RequestBody.create(file.getBytes(), OCTET_STREAM);
            MultipartBody body = new MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("file", file.getOriginalFilename(), fileBody)
                    .build();

            Request request = new Request.Builder()
                    .url(ragServiceUrl + "/kb/documents/upload")
                    .post(body)
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    throw new IOException("RAG knowledge upload request failed: " + response.code());
                }
                KnowledgeUploadResponse result = objectMapper.readValue(response.body().string(), KnowledgeUploadResponse.class);
                auditLogService.record("admin", "KNOWLEDGE_UPLOAD", "knowledge_document", result.getFileName(), result);
                return result;
            }
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "知识库上传失败", exception);
        }
    }

    public KnowledgeBuildResponse buildKnowledgeBase(KnowledgeBuildRequest requestPayload) {
        try {
            KnowledgeBuildRequest payload = requestPayload != null ? requestPayload : new KnowledgeBuildRequest();
            if (payload.getFileName() != null && !payload.getFileName().isBlank()) {
                return rebuildDocument(payload.getFileName());
            }
            String json = objectMapper.writeValueAsString(payload);
            Request request = new Request.Builder()
                    .url(ragServiceUrl + "/kb/ingest")
                    .post(RequestBody.create(json, MediaType.get("application/json; charset=utf-8")))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    throw new IOException("RAG knowledge build request failed: " + response.code());
                }
                KnowledgeBuildResponse result = objectMapper.readValue(response.body().string(), KnowledgeBuildResponse.class);
                String action = Boolean.TRUE.equals(payload.getRecreateCollection()) ? "KNOWLEDGE_RECREATE" : "KNOWLEDGE_BUILD";
                auditLogService.record("admin", action, "knowledge_collection", result.getCollection(), result);
                return result;
            }
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "知识库构建失败", exception);
        }
    }

    public KnowledgeBuildTaskDto submitBuildTask(KnowledgeBuildRequest requestPayload) {
        KnowledgeBuildRequest payload = requestPayload != null ? requestPayload : new KnowledgeBuildRequest();
        KnowledgeBuildTask task = new KnowledgeBuildTask();
        task.setStatus("PENDING");
        task.setProgress(0);
        task.setFileName(payload.getFileName());
        task.setRecreateCollection(Boolean.TRUE.equals(payload.getRecreateCollection()));
        task.setCreatedAt(LocalDateTime.now());
        taskRepository.save(task);
        buildExecutor.submit(() -> runBuildTask(task.getId()));
        return toTaskDto(task);
    }

    public List<KnowledgeBuildTaskDto> listBuildTasks() {
        return taskRepository.findTop50ByOrderByCreatedAtDesc().stream().map(this::toTaskDto).toList();
    }

    public KnowledgeBuildTaskDto retryBuildTask(Long id) {
        KnowledgeBuildTask source = taskRepository.findById(id).orElseThrow();
        KnowledgeBuildRequest request = new KnowledgeBuildRequest();
        request.setFileName(source.getFileName());
        request.setRecreateCollection(source.isRecreateCollection());
        return submitBuildTask(request);
    }

    public KnowledgeBuildTaskDto cancelBuildTask(Long id) {
        KnowledgeBuildTask task = taskRepository.findById(id).orElseThrow();
        if ("PENDING".equals(task.getStatus())) {
            task.setStatus("CANCELLED");
            task.setProgress(100);
            task.setFinishedAt(LocalDateTime.now());
            taskRepository.save(task);
        }
        return toTaskDto(task);
    }

    private void runBuildTask(Long id) {
        KnowledgeBuildTask task = taskRepository.findById(id).orElse(null);
        if (task == null || "CANCELLED".equals(task.getStatus())) {
            return;
        }
        task.setStatus("RUNNING");
        task.setProgress(10);
        task.setStartedAt(LocalDateTime.now());
        taskRepository.save(task);
        try {
            KnowledgeBuildResponse response = task.getFileName() != null && !task.getFileName().isBlank()
                    ? rebuildDocument(task.getFileName())
                    : buildKnowledgeBase(taskRequest(task));
            task.setFilesSeen(response.getFilesSeen());
            task.setFilesIndexed(response.getFilesIndexed());
            task.setChunksIndexed(response.getChunksIndexed());
            task.setStatus("SUCCEEDED");
            task.setProgress(100);
        } catch (Exception exception) {
            task.setStatus("FAILED");
            task.setProgress(100);
            task.setErrorMessage(exception.getMessage());
        }
        task.setFinishedAt(LocalDateTime.now());
        taskRepository.save(task);
    }

    private KnowledgeBuildRequest taskRequest(KnowledgeBuildTask task) {
        KnowledgeBuildRequest request = new KnowledgeBuildRequest();
        request.setRecreateCollection(task.isRecreateCollection());
        return request;
    }

    public KnowledgeBuildResponse rebuildDocument(String fileName) {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/kb/documents/" + encodePath(fileName) + "/rebuild")
                .post(RequestBody.create(new byte[0], null))
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("RAG knowledge document rebuild request failed: " + response.code());
            }
            KnowledgeBuildResponse result = objectMapper.readValue(response.body().string(), KnowledgeBuildResponse.class);
            auditLogService.record("admin", "KNOWLEDGE_REBUILD_FILE", "knowledge_document", fileName, result);
            return result;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "单文件重建失败", exception);
        }
    }

    public KnowledgeDeleteResponse deleteDocument(String fileName) {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/kb/documents/" + encodePath(fileName))
                .delete()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("RAG knowledge document delete request failed: " + response.code());
            }
            KnowledgeDeleteResponse result = objectMapper.readValue(response.body().string(), KnowledgeDeleteResponse.class);
            auditLogService.record("admin", "KNOWLEDGE_DELETE", "knowledge_document", fileName, result);
            return result;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "知识文件删除失败", exception);
        }
    }

    public KnowledgeChunkDto listDocumentChunks(String fileName) {
        Request request = new Request.Builder()
                .url(ragServiceUrl + "/kb/documents/" + encodePath(fileName) + "/chunks")
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("RAG knowledge chunks request failed: " + response.code());
            }
            JsonNode payload = objectMapper.readTree(response.body().string());
            return new KnowledgeChunkDto(payload.path("fileName").asText(fileName), payload.path("chunks"));
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "知识块查询失败", exception);
        }
    }

    public JsonNode previewDocument(String fileName) {
        return getKnowledgeJson("/kb/documents/" + encodePath(fileName) + "/preview", "文档解析预览失败");
    }

    public JsonNode diffDocument(String fileName) {
        return getKnowledgeJson("/kb/documents/" + encodePath(fileName) + "/diff", "文档 diff 查询失败");
    }

    public JsonNode setChunkDisabled(String chunkId, boolean disabled) {
        try {
            String payload = objectMapper.writeValueAsString(java.util.Map.of("disabled", disabled));
            Request request = new Request.Builder()
                    .url(ragServiceUrl + "/kb/chunks/" + encodePath(chunkId) + "/disabled")
                    .put(RequestBody.create(payload, MediaType.get("application/json; charset=utf-8")))
                    .build();
            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    throw new IOException("RAG chunk toggle request failed: " + response.code());
                }
                JsonNode result = objectMapper.readTree(response.body().string());
                auditLogService.record("admin", disabled ? "KNOWLEDGE_CHUNK_DISABLE" : "KNOWLEDGE_CHUNK_ENABLE", "knowledge_chunk", chunkId, result);
                return result;
            }
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "知识块启停失败", exception);
        }
    }

    private JsonNode getKnowledgeJson(String path, String errorMessage) {
        Request request = new Request.Builder()
                .url(ragServiceUrl + path)
                .get()
                .build();
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                throw new IOException("RAG knowledge request failed: " + response.code());
            }
            return objectMapper.readTree(response.body().string());
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, errorMessage, exception);
        }
    }

    private String encodePath(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private KnowledgeBuildTaskDto toTaskDto(KnowledgeBuildTask task) {
        return new KnowledgeBuildTaskDto(
                task.getId(),
                task.getStatus(),
                task.getFileName(),
                task.isRecreateCollection(),
                task.getProgress(),
                task.getFilesSeen(),
                task.getFilesIndexed(),
                task.getChunksIndexed(),
                task.getErrorMessage(),
                task.getCreatedAt(),
                task.getStartedAt(),
                task.getFinishedAt());
    }
}
