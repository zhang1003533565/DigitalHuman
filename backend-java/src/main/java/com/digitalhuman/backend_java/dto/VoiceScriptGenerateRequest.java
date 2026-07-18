package com.digitalhuman.backend_java.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.ArrayList;
import java.util.List;

public class VoiceScriptGenerateRequest {

    @NotNull(message = "MaxKB账号不能为空")
    private Long accountId;

    private Long facilityId;

    @NotBlank(message = "景点ID不能为空")
    private String spotId;

    @NotBlank(message = "风格不能为空")
    private String style = "culture";

    @NotNull(message = "目标时长不能为空")
    @Min(value = 20, message = "目标时长不能小于20秒")
    @Max(value = 300, message = "目标时长不能超过300秒")
    private Integer targetDurationSec = 60;

    private String additionalRequirements;

    @Valid
    private List<KnowledgeSource> knowledgeSources = new ArrayList<>();

    public Long getAccountId() {
        return accountId;
    }

    public void setAccountId(Long accountId) {
        this.accountId = accountId;
    }

    public Long getFacilityId() { return facilityId; }
    public void setFacilityId(Long value) { this.facilityId = value; }

    public String getSpotId() {
        return spotId;
    }

    public void setSpotId(String spotId) {
        this.spotId = spotId;
    }

    public String getStyle() {
        return style;
    }

    public void setStyle(String style) {
        this.style = style;
    }

    public Integer getTargetDurationSec() {
        return targetDurationSec;
    }

    public void setTargetDurationSec(Integer targetDurationSec) {
        this.targetDurationSec = targetDurationSec;
    }

    public String getAdditionalRequirements() {
        return additionalRequirements;
    }

    public void setAdditionalRequirements(String additionalRequirements) {
        this.additionalRequirements = additionalRequirements;
    }

    public List<KnowledgeSource> getKnowledgeSources() {
        return knowledgeSources;
    }

    public void setKnowledgeSources(List<KnowledgeSource> knowledgeSources) {
        this.knowledgeSources = knowledgeSources;
    }

    public static class KnowledgeSource {

        @NotBlank(message = "知识库ID不能为空")
        private String knowledgeId;

        private String knowledgeName;

        private List<String> documentIds = new ArrayList<>();

        public String getKnowledgeId() {
            return knowledgeId;
        }

        public void setKnowledgeId(String knowledgeId) {
            this.knowledgeId = knowledgeId;
        }

        public String getKnowledgeName() {
            return knowledgeName;
        }

        public void setKnowledgeName(String knowledgeName) {
            this.knowledgeName = knowledgeName;
        }

        public List<String> getDocumentIds() {
            return documentIds;
        }

        public void setDocumentIds(List<String> documentIds) {
            this.documentIds = documentIds;
        }
    }
}
