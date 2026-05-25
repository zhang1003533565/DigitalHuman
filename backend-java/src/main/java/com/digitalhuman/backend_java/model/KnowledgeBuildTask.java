package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "knowledge_build_task")
public class KnowledgeBuildTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 30)
    private String status;
    @Column(length = 200)
    private String fileName;
    @Column(nullable = false)
    private boolean recreateCollection;
    @Column(nullable = false)
    private int progress;
    private Integer filesSeen;
    private Integer filesIndexed;
    private Integer chunksIndexed;
    @Column(length = 1000)
    private String errorMessage;
    @Column(length = 2000)
    private String failedFilesJson;
    @Column(length = 4000)
    private String taskLog;
    @Column(nullable = false)
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;

    public Long getId() { return id; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public boolean isRecreateCollection() { return recreateCollection; }
    public void setRecreateCollection(boolean recreateCollection) { this.recreateCollection = recreateCollection; }
    public int getProgress() { return progress; }
    public void setProgress(int progress) { this.progress = progress; }
    public Integer getFilesSeen() { return filesSeen; }
    public void setFilesSeen(Integer filesSeen) { this.filesSeen = filesSeen; }
    public Integer getFilesIndexed() { return filesIndexed; }
    public void setFilesIndexed(Integer filesIndexed) { this.filesIndexed = filesIndexed; }
    public Integer getChunksIndexed() { return chunksIndexed; }
    public void setChunksIndexed(Integer chunksIndexed) { this.chunksIndexed = chunksIndexed; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public String getFailedFilesJson() { return failedFilesJson; }
    public void setFailedFilesJson(String failedFilesJson) { this.failedFilesJson = failedFilesJson; }
    public String getTaskLog() { return taskLog; }
    public void setTaskLog(String taskLog) { this.taskLog = taskLog; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getFinishedAt() { return finishedAt; }
    public void setFinishedAt(LocalDateTime finishedAt) { this.finishedAt = finishedAt; }
}
