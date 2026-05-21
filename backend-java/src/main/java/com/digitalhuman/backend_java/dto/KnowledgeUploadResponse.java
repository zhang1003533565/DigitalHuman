package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class KnowledgeUploadResponse {

    @JsonProperty("file_name")
    private String fileName;
    private IngestResultDto ingest;

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public IngestResultDto getIngest() {
        return ingest;
    }

    public void setIngest(IngestResultDto ingest) {
        this.ingest = ingest;
    }

    public static class IngestResultDto {
        @JsonProperty("files_seen")
        private Integer filesSeen;
        @JsonProperty("files_indexed")
        private Integer filesIndexed;
        @JsonProperty("chunks_indexed")
        private Integer chunksIndexed;
        private String collection;

        public Integer getFilesSeen() {
            return filesSeen;
        }

        public void setFilesSeen(Integer filesSeen) {
            this.filesSeen = filesSeen;
        }

        public Integer getFilesIndexed() {
            return filesIndexed;
        }

        public void setFilesIndexed(Integer filesIndexed) {
            this.filesIndexed = filesIndexed;
        }

        public Integer getChunksIndexed() {
            return chunksIndexed;
        }

        public void setChunksIndexed(Integer chunksIndexed) {
            this.chunksIndexed = chunksIndexed;
        }

        public String getCollection() {
            return collection;
        }

        public void setCollection(String collection) {
            this.collection = collection;
        }
    }
}
