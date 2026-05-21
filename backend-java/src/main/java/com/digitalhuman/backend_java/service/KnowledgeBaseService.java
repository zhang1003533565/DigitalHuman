package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.KnowledgeDocumentDto;
import com.digitalhuman.backend_java.dto.KnowledgeUploadResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.List;
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

    public KnowledgeBaseService() {
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
                return objectMapper.readValue(response.body().string(), KnowledgeUploadResponse.class);
            }
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "知识库上传失败", exception);
        }
    }
}
