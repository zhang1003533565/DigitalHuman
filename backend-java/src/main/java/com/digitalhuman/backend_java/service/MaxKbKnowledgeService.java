package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.MaxKbKnowledgeDto;
import com.digitalhuman.backend_java.dto.PageResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

public interface MaxKbKnowledgeService {

    List<MaxKbKnowledgeDto.EnvironmentOption> listEnvironmentOptions();

    PageResponse<MaxKbKnowledgeDto.AccountVo> listAccounts(
            Integer current,
            Integer size,
            String keyword,
            String environment,
            Integer status
    );

    MaxKbKnowledgeDto.AccountVo createAccount(MaxKbKnowledgeDto.AccountCreateRequest request);

    MaxKbKnowledgeDto.AccountVo updateAccount(Long accountId, MaxKbKnowledgeDto.AccountUpdateRequest request);

    void deleteAccount(Long accountId);

    MaxKbKnowledgeDto.AccountVo updateAccountStatus(Long accountId, Integer status);

    Object testConnection(Long accountId);

    Object docs(Long accountId);

    Object listKnowledges(Long accountId, Map<String, String> queryParams);

    Object getKnowledge(Long accountId, String knowledgeId);

    Object listDocuments(Long accountId, String knowledgeId, Map<String, String> queryParams);

    Object uploadDocuments(
            Long accountId,
            String knowledgeId,
            List<MultipartFile> files,
            Integer limit,
            List<String> patterns,
            Boolean withFilter,
            String splitStrategy,
            String modelId
    );

    Object listParagraphs(Long accountId, String knowledgeId, String documentId, Map<String, String> queryParams);

    ResponseEntity<byte[]> proxyAsset(Long accountId, String path);

    Object hitTest(Long accountId, Map<String, Object> request);
}
