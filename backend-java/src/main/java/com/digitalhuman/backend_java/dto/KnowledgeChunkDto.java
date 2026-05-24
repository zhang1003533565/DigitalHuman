package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.databind.JsonNode;

public class KnowledgeChunkDto {

    private String fileName;
    private JsonNode chunks;

    public KnowledgeChunkDto(String fileName, JsonNode chunks) {
        this.fileName = fileName;
        this.chunks = chunks;
    }

    public String getFileName() {
        return fileName;
    }

    public JsonNode getChunks() {
        return chunks;
    }
}
