package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class MaxKbKnowledgeDto {

    public static class AccountCreateRequest {
        @NotBlank(message = "账号名称不能为空")
        private String accountName;

        @NotBlank(message = "MaxKB 服务地址不能为空")
        private String baseUrl;

        private String environment = "local";

        @NotBlank(message = "MaxKB OpenAPI Key 不能为空")
        private String apiKey;

        @NotBlank(message = "MaxKB 工作空间 ID 不能为空")
        private String workspaceId;

        private String remark;

        @NotNull(message = "状态不能为空")
        private Integer status = 1;

        public String getAccountName() {
            return accountName;
        }

        public void setAccountName(String accountName) {
            this.accountName = accountName;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getEnvironment() {
            return environment;
        }

        public void setEnvironment(String environment) {
            this.environment = environment;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getWorkspaceId() {
            return workspaceId;
        }

        public void setWorkspaceId(String workspaceId) {
            this.workspaceId = workspaceId;
        }

        public String getRemark() {
            return remark;
        }

        public void setRemark(String remark) {
            this.remark = remark;
        }

        public Integer getStatus() {
            return status;
        }

        public void setStatus(Integer status) {
            this.status = status;
        }
    }

    public static class AccountUpdateRequest {
        @NotBlank(message = "账号名称不能为空")
        private String accountName;

        @NotBlank(message = "MaxKB 服务地址不能为空")
        private String baseUrl;

        private String environment = "local";

        private String apiKey;

        @NotBlank(message = "MaxKB 工作空间 ID 不能为空")
        private String workspaceId;

        private String remark;

        @NotNull(message = "状态不能为空")
        private Integer status;

        public String getAccountName() {
            return accountName;
        }

        public void setAccountName(String accountName) {
            this.accountName = accountName;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getEnvironment() {
            return environment;
        }

        public void setEnvironment(String environment) {
            this.environment = environment;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getWorkspaceId() {
            return workspaceId;
        }

        public void setWorkspaceId(String workspaceId) {
            this.workspaceId = workspaceId;
        }

        public String getRemark() {
            return remark;
        }

        public void setRemark(String remark) {
            this.remark = remark;
        }

        public Integer getStatus() {
            return status;
        }

        public void setStatus(Integer status) {
            this.status = status;
        }
    }

    public static class AccountStatusRequest {
        @NotNull(message = "状态不能为空")
        private Integer status;

        public Integer getStatus() {
            return status;
        }

        public void setStatus(Integer status) {
            this.status = status;
        }
    }

    public static class AccountVo {
        private Long id;
        private String accountName;
        private String baseUrl;
        private String environment;
        private String environmentText;
        private String workspaceId;
        private String remark;
        private Integer status;
        private String statusText;
        private Boolean apiKeyConfigured;
        private String apiKeyMasked;
        private String createTime;
        private String updateTime;

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public String getAccountName() {
            return accountName;
        }

        public void setAccountName(String accountName) {
            this.accountName = accountName;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getEnvironment() {
            return environment;
        }

        public void setEnvironment(String environment) {
            this.environment = environment;
        }

        public String getEnvironmentText() {
            return environmentText;
        }

        public void setEnvironmentText(String environmentText) {
            this.environmentText = environmentText;
        }

        public String getWorkspaceId() {
            return workspaceId;
        }

        public void setWorkspaceId(String workspaceId) {
            this.workspaceId = workspaceId;
        }

        public String getRemark() {
            return remark;
        }

        public void setRemark(String remark) {
            this.remark = remark;
        }

        public Integer getStatus() {
            return status;
        }

        public void setStatus(Integer status) {
            this.status = status;
        }

        public String getStatusText() {
            return statusText;
        }

        public void setStatusText(String statusText) {
            this.statusText = statusText;
        }

        public Boolean getApiKeyConfigured() {
            return apiKeyConfigured;
        }

        public void setApiKeyConfigured(Boolean apiKeyConfigured) {
            this.apiKeyConfigured = apiKeyConfigured;
        }

        public String getApiKeyMasked() {
            return apiKeyMasked;
        }

        public void setApiKeyMasked(String apiKeyMasked) {
            this.apiKeyMasked = apiKeyMasked;
        }

        public String getCreateTime() {
            return createTime;
        }

        public void setCreateTime(String createTime) {
            this.createTime = createTime;
        }

        public String getUpdateTime() {
            return updateTime;
        }

        public void setUpdateTime(String updateTime) {
            this.updateTime = updateTime;
        }
    }

    public static class EnvironmentOption {
        private String value;
        private String label;
        private String description;

        public EnvironmentOption() {
        }

        public EnvironmentOption(String value, String label, String description) {
            this.value = value;
            this.label = label;
            this.description = description;
        }

        public String getValue() {
            return value;
        }

        public void setValue(String value) {
            this.value = value;
        }

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }
    }
}
