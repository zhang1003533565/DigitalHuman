package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.config.AuthInterceptor;
import com.digitalhuman.backend_java.dto.ApiResult;
import com.digitalhuman.backend_java.dto.MaxKbKnowledgeDto;
import com.digitalhuman.backend_java.dto.PageResponse;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.service.MaxKbKnowledgeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/knowledge/maxkb", "/api/admin/knowledge/maxkb"})
public class MaxKbKnowledgeController {

    private final MaxKbKnowledgeService maxKbKnowledgeService;

    public MaxKbKnowledgeController(MaxKbKnowledgeService maxKbKnowledgeService) {
        this.maxKbKnowledgeService = maxKbKnowledgeService;
    }

    @GetMapping("/environments")
    public ApiResult<List<MaxKbKnowledgeDto.EnvironmentOption>> listEnvironments(HttpServletRequest request) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.listEnvironmentOptions());
    }

    @GetMapping("/accounts")
    public ApiResult<PageResponse<MaxKbKnowledgeDto.AccountVo>> listAccounts(
            @RequestParam(defaultValue = "1") Integer current,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String environment,
            @RequestParam(required = false) Integer status,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.listAccounts(current, size, keyword, environment, status));
    }

    @PostMapping("/accounts")
    public ApiResult<MaxKbKnowledgeDto.AccountVo> createAccount(
            @Valid @RequestBody MaxKbKnowledgeDto.AccountCreateRequest body,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success("创建成功", maxKbKnowledgeService.createAccount(body));
    }

    @PutMapping("/accounts/{accountId}")
    public ApiResult<MaxKbKnowledgeDto.AccountVo> updateAccount(
            @PathVariable Long accountId,
            @Valid @RequestBody MaxKbKnowledgeDto.AccountUpdateRequest body,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success("更新成功", maxKbKnowledgeService.updateAccount(accountId, body));
    }

    @DeleteMapping("/accounts/{accountId}")
    public ApiResult<Void> deleteAccount(@PathVariable Long accountId, HttpServletRequest request) {
        requireAdmin(request);
        maxKbKnowledgeService.deleteAccount(accountId);
        return ApiResult.success("删除成功", null);
    }

    @PutMapping("/accounts/{accountId}/status")
    public ApiResult<MaxKbKnowledgeDto.AccountVo> updateAccountStatus(
            @PathVariable Long accountId,
            @Valid @RequestBody MaxKbKnowledgeDto.AccountStatusRequest body,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success("状态更新成功", maxKbKnowledgeService.updateAccountStatus(accountId, body.getStatus()));
    }

    @PostMapping("/accounts/{accountId}/test")
    public ApiResult<Object> test(@PathVariable Long accountId, HttpServletRequest request) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.testConnection(accountId));
    }

    @GetMapping("/accounts/{accountId}/docs")
    public ApiResult<Object> docs(@PathVariable Long accountId, HttpServletRequest request) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.docs(accountId));
    }

    @GetMapping("/accounts/{accountId}/knowledges")
    public ApiResult<Object> listKnowledges(
            @PathVariable Long accountId,
            @RequestParam Map<String, String> queryParams,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.listKnowledges(accountId, queryParams));
    }

    @GetMapping("/accounts/{accountId}/knowledges/{knowledgeId}")
    public ApiResult<Object> getKnowledge(
            @PathVariable Long accountId,
            @PathVariable String knowledgeId,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.getKnowledge(accountId, knowledgeId));
    }

    @GetMapping("/accounts/{accountId}/knowledges/{knowledgeId}/documents")
    public ApiResult<Object> listDocuments(
            @PathVariable Long accountId,
            @PathVariable String knowledgeId,
            @RequestParam Map<String, String> queryParams,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.listDocuments(accountId, knowledgeId, queryParams));
    }

    @PostMapping(value = "/accounts/{accountId}/knowledges/{knowledgeId}/documents/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResult<Object> uploadDocuments(
            @PathVariable Long accountId,
            @PathVariable String knowledgeId,
            @RequestParam(required = false, name = "file") List<MultipartFile> files,
            @RequestParam(required = false, name = "file_id") List<String> fileIds,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) List<String> patterns,
            @RequestParam(required = false, name = "with_filter") Boolean withFilter,
            @RequestParam(required = false, name = "split_strategy") String splitStrategy,
            @RequestParam(required = false, name = "model_id") String modelId,
            @RequestParam(required = false, name = "vision_model_id") String visionModelId,
            @RequestParam(required = false, name = "llm_model_id") String llmModelId,
            @RequestParam(required = false, name = "quality_optimize") Boolean qualityOptimize,
            @RequestParam(required = false, name = "auto_apply") Boolean autoApply,
            @RequestParam(required = false, name = "idempotency_key") String idempotencyKey,
            @RequestHeader(required = false, name = "Idempotency-Key") String idempotencyKeyHeader,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.uploadDocuments(
                accountId,
                knowledgeId,
                files,
                fileIds,
                limit,
                patterns,
                withFilter,
                splitStrategy,
                modelId,
                visionModelId,
                llmModelId,
                qualityOptimize,
                autoApply,
                idempotencyKeyHeader != null && !idempotencyKeyHeader.isBlank() ? idempotencyKeyHeader : idempotencyKey
        ));
    }

    @GetMapping("/accounts/{accountId}/knowledges/{knowledgeId}/documents/upload-tasks")
    public ApiResult<Object> listUploadTasks(
            @PathVariable Long accountId,
            @PathVariable String knowledgeId,
            @RequestParam Map<String, String> queryParams,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.listUploadTasks(accountId, knowledgeId, queryParams));
    }

    @GetMapping("/accounts/{accountId}/knowledges/{knowledgeId}/documents/upload-tasks/{taskId}")
    public ApiResult<Object> getUploadTask(
            @PathVariable Long accountId,
            @PathVariable String knowledgeId,
            @PathVariable String taskId,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.getUploadTask(accountId, knowledgeId, taskId));
    }

    @GetMapping("/accounts/{accountId}/knowledges/{knowledgeId}/documents/upload-tasks/{taskId}/preview")
    public ApiResult<Object> previewUploadTask(
            @PathVariable Long accountId,
            @PathVariable String knowledgeId,
            @PathVariable String taskId,
            @RequestParam Map<String, String> queryParams,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.previewUploadTask(accountId, knowledgeId, taskId, queryParams));
    }

    @PostMapping("/accounts/{accountId}/knowledges/{knowledgeId}/documents/upload-tasks/{taskId}/apply")
    public ApiResult<Object> applyUploadTask(
            @PathVariable Long accountId,
            @PathVariable String knowledgeId,
            @PathVariable String taskId,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.applyUploadTask(accountId, knowledgeId, taskId));
    }

    @PostMapping("/accounts/{accountId}/knowledges/{knowledgeId}/documents/upload-tasks/{taskId}/cancel")
    public ApiResult<Object> cancelUploadTask(
            @PathVariable Long accountId,
            @PathVariable String knowledgeId,
            @PathVariable String taskId,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.cancelUploadTask(accountId, knowledgeId, taskId));
    }

    @DeleteMapping("/accounts/{accountId}/knowledges/{knowledgeId}/documents/upload-tasks/{taskId}")
    public ApiResult<Object> deleteUploadTask(
            @PathVariable Long accountId,
            @PathVariable String knowledgeId,
            @PathVariable String taskId,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.deleteUploadTask(accountId, knowledgeId, taskId));
    }

    @GetMapping("/accounts/{accountId}/knowledges/{knowledgeId}/documents/{documentId}/paragraphs")
    public ApiResult<Object> listParagraphs(
            @PathVariable Long accountId,
            @PathVariable String knowledgeId,
            @PathVariable String documentId,
            @RequestParam Map<String, String> queryParams,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.listParagraphs(accountId, knowledgeId, documentId, queryParams));
    }

    @GetMapping("/accounts/{accountId}/assets")
    public ResponseEntity<byte[]> proxyAsset(
            @PathVariable Long accountId,
            @RequestParam String path,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return maxKbKnowledgeService.proxyAsset(accountId, path);
    }

    @PostMapping("/accounts/{accountId}/hit-test")
    public ApiResult<Object> hitTest(
            @PathVariable Long accountId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request
    ) {
        requireAdmin(request);
        return ApiResult.success(maxKbKnowledgeService.hitTest(accountId, body));
    }

    private void requireAdmin(HttpServletRequest request) {
        Object session = request.getAttribute(AuthInterceptor.REQUEST_ATTR_AUTH_SESSION);
        if (!(session instanceof AuthSession authSession)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        if (authSession.getRole() != UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权限操作，仅管理员可执行");
        }
    }
}
