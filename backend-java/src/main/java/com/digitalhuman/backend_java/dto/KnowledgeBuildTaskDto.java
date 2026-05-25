package com.digitalhuman.backend_java.dto;

import java.time.LocalDateTime;

public class KnowledgeBuildTaskDto {
    private final Long id;
    private final String status;
    private final String fileName;
    private final boolean recreateCollection;
    private final int progress;
    private final Integer filesSeen;
    private final Integer filesIndexed;
    private final Integer chunksIndexed;
    private final String errorMessage;
    private final LocalDateTime createdAt;
    private final LocalDateTime startedAt;
    private final LocalDateTime finishedAt;

    public KnowledgeBuildTaskDto(Long id, String status, String fileName, boolean recreateCollection, int progress, Integer filesSeen, Integer filesIndexed, Integer chunksIndexed, String errorMessage, LocalDateTime createdAt, LocalDateTime startedAt, LocalDateTime finishedAt) {
        this.id = id;
        this.status = status;
        this.fileName = fileName;
        this.recreateCollection = recreateCollection;
        this.progress = progress;
        this.filesSeen = filesSeen;
        this.filesIndexed = filesIndexed;
        this.chunksIndexed = chunksIndexed;
        this.errorMessage = errorMessage;
        this.createdAt = createdAt;
        this.startedAt = startedAt;
        this.finishedAt = finishedAt;
    }

    public Long getId() { return id; }
    public String getStatus() { return status; }
    public String getFileName() { return fileName; }
    public boolean isRecreateCollection() { return recreateCollection; }
    public int getProgress() { return progress; }
    public Integer getFilesSeen() { return filesSeen; }
    public Integer getFilesIndexed() { return filesIndexed; }
    public Integer getChunksIndexed() { return chunksIndexed; }
    public String getErrorMessage() { return errorMessage; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public LocalDateTime getFinishedAt() { return finishedAt; }
}
