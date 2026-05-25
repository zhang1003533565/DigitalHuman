package com.digitalhuman.backend_java.dto;

import java.time.LocalDateTime;

public class KnowledgeBuildTaskDto {
    private final Long id;
    private final String status;
    private final String fileName;
    private final String embeddingModel;
    private final String embeddingProvider;
    private final boolean recreateCollection;
    private final int progress;
    private final Integer filesSeen;
    private final Integer filesIndexed;
    private final Integer chunksIndexed;
    private final String errorMessage;
    private final String failedFilesJson;
    private final String taskLog;
    private final LocalDateTime createdAt;
    private final LocalDateTime startedAt;
    private final LocalDateTime finishedAt;

    public KnowledgeBuildTaskDto(Long id, String status, String fileName, String embeddingProvider, String embeddingModel, boolean recreateCollection, int progress, Integer filesSeen, Integer filesIndexed, Integer chunksIndexed, String errorMessage, String failedFilesJson, String taskLog, LocalDateTime createdAt, LocalDateTime startedAt, LocalDateTime finishedAt) {
        this.id = id;
        this.status = status;
        this.fileName = fileName;
        this.embeddingProvider = embeddingProvider;
        this.embeddingModel = embeddingModel;
        this.recreateCollection = recreateCollection;
        this.progress = progress;
        this.filesSeen = filesSeen;
        this.filesIndexed = filesIndexed;
        this.chunksIndexed = chunksIndexed;
        this.errorMessage = errorMessage;
        this.failedFilesJson = failedFilesJson;
        this.taskLog = taskLog;
        this.createdAt = createdAt;
        this.startedAt = startedAt;
        this.finishedAt = finishedAt;
    }

    public Long getId() { return id; }
    public String getStatus() { return status; }
    public String getFileName() { return fileName; }
    public String getEmbeddingModel() { return embeddingModel; }
    public String getEmbeddingProvider() { return embeddingProvider; }
    public boolean isRecreateCollection() { return recreateCollection; }
    public int getProgress() { return progress; }
    public Integer getFilesSeen() { return filesSeen; }
    public Integer getFilesIndexed() { return filesIndexed; }
    public Integer getChunksIndexed() { return chunksIndexed; }
    public String getErrorMessage() { return errorMessage; }
    public String getFailedFilesJson() { return failedFilesJson; }
    public String getTaskLog() { return taskLog; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public LocalDateTime getFinishedAt() { return finishedAt; }
}
