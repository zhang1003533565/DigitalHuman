package com.digitalhuman.backend_java.service.impl;

import com.digitalhuman.backend_java.dto.MaxKbKnowledgeDto;
import com.digitalhuman.backend_java.dto.PageResponse;
import com.digitalhuman.backend_java.model.MaxKbAccount;
import com.digitalhuman.backend_java.repository.MaxKbAccountRepository;
import com.digitalhuman.backend_java.service.MaxKbKnowledgeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.criteria.Predicate;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
public class MaxKbKnowledgeServiceImpl implements MaxKbKnowledgeService {

    private static final String OPEN_API_PREFIX = "/openapi/knowledge/v1";
    private static final String DEFAULT_DOCUMENT_TASK_TYPE = "1";
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final MediaType OCTET_STREAM = MediaType.get("application/octet-stream");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final MaxKbAccountRepository maxKbAccountRepository;
    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;

    public MaxKbKnowledgeServiceImpl(
            MaxKbAccountRepository maxKbAccountRepository,
            ObjectMapper objectMapper,
            @Value("${knowledge.maxkb.timeout-seconds:30}") long timeoutSeconds
    ) {
        this.maxKbAccountRepository = maxKbAccountRepository;
        this.objectMapper = objectMapper;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .writeTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .build();
    }

    @Override
    public List<MaxKbKnowledgeDto.EnvironmentOption> listEnvironmentOptions() {
        return List.of(
                new MaxKbKnowledgeDto.EnvironmentOption("local", "本地", "本机或局域网 MaxKB 服务地址"),
                new MaxKbKnowledgeDto.EnvironmentOption("test", "测试", "测试环境 MaxKB 服务地址"),
                new MaxKbKnowledgeDto.EnvironmentOption("prod", "线上", "生产环境 MaxKB 服务地址"),
                new MaxKbKnowledgeDto.EnvironmentOption("custom", "自定义", "其他临时或专用 MaxKB 服务地址")
        );
    }

    @Override
    public PageResponse<MaxKbKnowledgeDto.AccountVo> listAccounts(
            Integer current,
            Integer size,
            String keyword,
            String environment,
            Integer status
    ) {
        int page = current == null || current < 1 ? 1 : current;
        int pageSize = size == null || size < 1 ? 10 : size;
        Specification<MaxKbAccount> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (StringUtils.hasText(keyword)) {
                String pattern = "%" + keyword.trim() + "%";
                predicates.add(cb.or(
                        cb.like(root.get("accountName"), pattern),
                        cb.like(root.get("baseUrl"), pattern),
                        cb.like(root.get("workspaceId"), pattern),
                        cb.like(root.get("remark"), pattern)
                ));
            }
            if (StringUtils.hasText(environment)) {
                predicates.add(cb.equal(root.get("environment"), normalizeEnvironment(environment)));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
        Page<MaxKbAccount> result = maxKbAccountRepository.findAll(
                spec,
                PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "updateTime", "id"))
        );
        return new PageResponse<>(
                result.getContent().stream().map(this::toVo).toList(),
                result.getTotalElements(),
                page,
                pageSize
        );
    }

    @Override
    public MaxKbKnowledgeDto.AccountVo createAccount(MaxKbKnowledgeDto.AccountCreateRequest request) {
        MaxKbEndpoint endpoint = normalizeEndpoint(request.getBaseUrl(), request.getWorkspaceId());
        MaxKbAccount account = new MaxKbAccount();
        account.setAccountName(trim(request.getAccountName()));
        account.setBaseUrl(endpoint.baseUrl());
        account.setEnvironment(normalizeEnvironment(request.getEnvironment()));
        account.setApiKey(trim(request.getApiKey()));
        account.setWorkspaceId(endpoint.workspaceId());
        account.setRemark(trimToNull(request.getRemark()));
        account.setStatus(normalizeStatus(request.getStatus()));
        return toVo(maxKbAccountRepository.save(account));
    }

    @Override
    public MaxKbKnowledgeDto.AccountVo updateAccount(Long accountId, MaxKbKnowledgeDto.AccountUpdateRequest request) {
        MaxKbEndpoint endpoint = normalizeEndpoint(request.getBaseUrl(), request.getWorkspaceId());
        MaxKbAccount account = getAccount(accountId, false);
        account.setAccountName(trim(request.getAccountName()));
        account.setBaseUrl(endpoint.baseUrl());
        account.setEnvironment(normalizeEnvironment(request.getEnvironment()));
        if (StringUtils.hasText(request.getApiKey())) {
            account.setApiKey(trim(request.getApiKey()));
        }
        account.setWorkspaceId(endpoint.workspaceId());
        account.setRemark(trimToNull(request.getRemark()));
        account.setStatus(normalizeStatus(request.getStatus()));
        return toVo(maxKbAccountRepository.save(account));
    }

    @Override
    public void deleteAccount(Long accountId) {
        maxKbAccountRepository.delete(getAccount(accountId, false));
    }

    @Override
    public MaxKbKnowledgeDto.AccountVo updateAccountStatus(Long accountId, Integer status) {
        MaxKbAccount account = getAccount(accountId, false);
        account.setStatus(normalizeStatus(status));
        return toVo(maxKbAccountRepository.save(account));
    }

    @Override
    public Object testConnection(Long accountId) {
        MaxKbAccount account = getAccount(accountId, true);
        return getObject(account, "/workspaces/" + account.getWorkspaceId() + "/knowledges", Map.of("page", "1", "page_size", "1"));
    }

    @Override
    public Object docs(Long accountId) {
        return getObject(getAccount(accountId, true), "/docs", null);
    }

    @Override
    public Object listKnowledges(Long accountId, Map<String, String> queryParams) {
        MaxKbAccount account = getAccount(accountId, true);
        return getObject(account, "/workspaces/" + account.getWorkspaceId() + "/knowledges", queryParams);
    }

    @Override
    public Object getKnowledge(Long accountId, String knowledgeId) {
        MaxKbAccount account = getAccount(accountId, true);
        return getObject(
                account,
                "/workspaces/" + account.getWorkspaceId() + "/knowledges/" + requireId(knowledgeId, "知识库 ID"),
                null
        );
    }

    @Override
    public Object listDocuments(Long accountId, String knowledgeId, Map<String, String> queryParams) {
        MaxKbAccount account = getAccount(accountId, true);
        return getObject(
                account,
                "/workspaces/" + account.getWorkspaceId()
                        + "/knowledges/" + requireId(knowledgeId, "知识库 ID")
                        + "/documents",
                withDefaultDocumentTaskType(queryParams)
        );
    }

    @Override
    public Object uploadDocuments(
            Long accountId,
            String knowledgeId,
            List<MultipartFile> files,
            List<String> fileIds,
            Integer limit,
            List<String> patterns,
            Boolean withFilter,
            String splitStrategy,
            String modelId,
            String visionModelId,
            String llmModelId,
            Boolean qualityOptimize,
            Boolean autoApply,
            String idempotencyKey
    ) {
        MaxKbAccount account = getAccount(accountId, true);
        boolean hasFiles = files != null && files.stream().anyMatch(file -> file != null && !file.isEmpty());
        boolean hasFileIds = fileIds != null && fileIds.stream().anyMatch(StringUtils::hasText);
        if (!hasFiles && !hasFileIds) {
            throw status(HttpStatus.BAD_REQUEST, "上传文件或复用文件 ID 不能为空");
        }

        MultipartBody.Builder bodyBuilder = new MultipartBody.Builder().setType(MultipartBody.FORM);
        if (files != null) {
            files.stream()
                    .filter(file -> file != null && !file.isEmpty())
                    .forEach(file -> addFilePart(bodyBuilder, file));
        }
        if (fileIds != null) {
            fileIds.stream()
                    .filter(StringUtils::hasText)
                    .forEach(fileId -> bodyBuilder.addFormDataPart("file_id", fileId.trim()));
        }
        bodyBuilder.addFormDataPart("limit", String.valueOf(limit == null ? 4096 : limit));
        if (patterns != null) {
            patterns.stream()
                    .filter(StringUtils::hasText)
                    .forEach(pattern -> bodyBuilder.addFormDataPart("patterns", pattern.trim()));
        }
        if (withFilter != null) {
            bodyBuilder.addFormDataPart("with_filter", String.valueOf(withFilter));
        }
        if (StringUtils.hasText(splitStrategy)) {
            bodyBuilder.addFormDataPart("split_strategy", splitStrategy.trim());
        }
        if (StringUtils.hasText(modelId)) {
            bodyBuilder.addFormDataPart("model_id", modelId.trim());
        }
        if (StringUtils.hasText(visionModelId)) {
            bodyBuilder.addFormDataPart("vision_model_id", visionModelId.trim());
        }
        if (StringUtils.hasText(llmModelId)) {
            bodyBuilder.addFormDataPart("llm_model_id", llmModelId.trim());
        }
        if (qualityOptimize != null) {
            bodyBuilder.addFormDataPart("quality_optimize", String.valueOf(qualityOptimize));
        }
        if (autoApply != null) {
            bodyBuilder.addFormDataPart("auto_apply", String.valueOf(autoApply));
        }

        String path = "/workspaces/" + account.getWorkspaceId()
                + "/knowledges/" + requireId(knowledgeId, "知识库 ID")
                + "/documents/upload";
        Request.Builder requestBuilder = baseRequest(account, path, null).post(bodyBuilder.build());
        if (StringUtils.hasText(idempotencyKey)) {
            requestBuilder.header("Idempotency-Key", idempotencyKey.trim());
        }
        Request request = requestBuilder.build();
        return executeObject(request, "MaxKB 文件上传失败");
    }

    @Override
    public Object listUploadTasks(Long accountId, String knowledgeId, Map<String, String> queryParams) {
        MaxKbAccount account = getAccount(accountId, true);
        return getObject(account, uploadTasksPath(account, knowledgeId), queryParams);
    }

    @Override
    public Object getUploadTask(Long accountId, String knowledgeId, String taskId) {
        MaxKbAccount account = getAccount(accountId, true);
        return getObject(account, uploadTaskPath(account, knowledgeId, taskId), null);
    }

    @Override
    public Object previewUploadTask(Long accountId, String knowledgeId, String taskId, Map<String, String> queryParams) {
        MaxKbAccount account = getAccount(accountId, true);
        return getObject(account, uploadTaskPath(account, knowledgeId, taskId) + "/preview", queryParams);
    }

    @Override
    public Object applyUploadTask(Long accountId, String knowledgeId, String taskId) {
        MaxKbAccount account = getAccount(accountId, true);
        return postEmptyObject(account, uploadTaskPath(account, knowledgeId, taskId) + "/apply");
    }

    @Override
    public Object cancelUploadTask(Long accountId, String knowledgeId, String taskId) {
        MaxKbAccount account = getAccount(accountId, true);
        return postEmptyObject(account, uploadTaskPath(account, knowledgeId, taskId) + "/cancel");
    }

    @Override
    public Object deleteUploadTask(Long accountId, String knowledgeId, String taskId) {
        MaxKbAccount account = getAccount(accountId, true);
        return deleteObject(account, uploadTaskPath(account, knowledgeId, taskId));
    }

    @Override
    public Object listParagraphs(Long accountId, String knowledgeId, String documentId, Map<String, String> queryParams) {
        MaxKbAccount account = getAccount(accountId, true);
        return getObject(
                account,
                "/workspaces/" + account.getWorkspaceId()
                        + "/knowledges/" + requireId(knowledgeId, "知识库 ID")
                        + "/documents/" + requireId(documentId, "文档 ID")
                        + "/paragraphs",
                queryParams
        );
    }

    @Override
    public ResponseEntity<byte[]> proxyAsset(Long accountId, String path) {
        MaxKbAccount account = getAccount(accountId, true);
        String assetPath = normalizeAssetPath(account, path);
        List<String> candidatePaths = buildAssetPathCandidates(assetPath);
        String lastErrorMessage = null;
        for (String candidatePath : candidatePaths) {
            HttpUrl url = HttpUrl.parse(normalizeServiceRootUrl(account.getBaseUrl()) + candidatePath);
            if (url == null) {
                lastErrorMessage = "图片地址不合法";
                continue;
            }
            Request request = new Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer " + account.getApiKey().trim())
                    .get()
                    .build();
            try (Response response = httpClient.newCall(request).execute()) {
                byte[] body = response.body() == null ? new byte[0] : response.body().bytes();
                if (!response.isSuccessful()) {
                    lastErrorMessage = body.length == 0 ? "HTTP " + response.code() : new String(body);
                    continue;
                }
                HttpHeaders headers = new HttpHeaders();
                String contentType = response.header("Content-Type");
                if (StringUtils.hasText(contentType)) {
                    headers.setContentType(org.springframework.http.MediaType.parseMediaType(contentType));
                } else {
                    headers.setContentType(org.springframework.http.MediaType.APPLICATION_OCTET_STREAM);
                }
                headers.set(HttpHeaders.CACHE_CONTROL, "private, max-age=300");
                return ResponseEntity.status(HttpStatusCode.valueOf(response.code())).headers(headers).body(body);
            } catch (IOException error) {
                lastErrorMessage = error.getMessage();
            }
        }
        throw status(HttpStatus.BAD_GATEWAY, "MaxKB 图片资源加载失败: " + (lastErrorMessage == null ? "未知错误" : lastErrorMessage));
    }

    @Override
    public Object hitTest(Long accountId, Map<String, Object> request) {
        MaxKbAccount account = getAccount(accountId, true);
        return postObject(account, "/workspaces/" + account.getWorkspaceId() + "/hit-test", request);
    }

    private Object getObject(MaxKbAccount account, String path, Map<String, String> queryParams) {
        return executeObject(baseRequest(account, path, queryParams).get().build(), "MaxKB 服务调用失败");
    }

    private Object postObject(MaxKbAccount account, String path, Map<String, Object> payload) {
        try {
            Request request = baseRequest(account, path, null)
                    .post(RequestBody.create(objectMapper.writeValueAsString(payload == null ? Map.of() : payload), JSON))
                    .build();
            return executeObject(request, "MaxKB 服务调用失败");
        } catch (IOException error) {
            throw status(HttpStatus.INTERNAL_SERVER_ERROR, "构造 MaxKB 请求失败: " + error.getMessage(), error);
        }
    }

    private Object postEmptyObject(MaxKbAccount account, String path) {
        Request request = baseRequest(account, path, null)
                .post(RequestBody.create(new byte[0], null))
                .build();
        return executeObject(request, "MaxKB 服务调用失败");
    }

    private Object deleteObject(MaxKbAccount account, String path) {
        Request request = baseRequest(account, path, null).delete().build();
        return executeObject(request, "MaxKB 服务调用失败");
    }

    private String uploadTasksPath(MaxKbAccount account, String knowledgeId) {
        return "/workspaces/" + account.getWorkspaceId()
                + "/knowledges/" + requireId(knowledgeId, "知识库 ID")
                + "/documents/upload-tasks";
    }

    private String uploadTaskPath(MaxKbAccount account, String knowledgeId, String taskId) {
        return uploadTasksPath(account, knowledgeId) + "/" + requireId(taskId, "任务 ID");
    }

    private Request.Builder baseRequest(MaxKbAccount account, String path, Map<String, String> queryParams) {
        HttpUrl baseUrl = HttpUrl.parse(normalizeServiceRootUrl(account.getBaseUrl()) + OPEN_API_PREFIX + path);
        if (baseUrl == null) {
            throw status(HttpStatus.BAD_REQUEST, "MaxKB 服务地址不合法");
        }
        HttpUrl.Builder urlBuilder = baseUrl.newBuilder();
        if (queryParams != null) {
            queryParams.forEach((key, value) -> {
                if (StringUtils.hasText(key) && StringUtils.hasText(value)) {
                    urlBuilder.addQueryParameter(key, value);
                }
            });
        }
        return new Request.Builder()
                .url(urlBuilder.build())
                .header("Authorization", "Bearer " + account.getApiKey().trim());
    }

    private MaxKbEndpoint normalizeEndpoint(String rawBaseUrl, String rawWorkspaceId) {
        String baseUrl = normalizeServiceRootUrl(rawBaseUrl);
        String workspaceId = firstNonBlank(extractWorkspaceId(rawBaseUrl), rawWorkspaceId);
        return new MaxKbEndpoint(baseUrl, trim(workspaceId));
    }

    private String normalizeServiceRootUrl(String rawBaseUrl) {
        String value = trimTrailingSlash(rawBaseUrl);
        int openApiIndex = value.indexOf(OPEN_API_PREFIX);
        if (openApiIndex >= 0) {
            value = value.substring(0, openApiIndex);
        }
        return trimTrailingSlash(value);
    }

    private String extractWorkspaceId(String rawBaseUrl) {
        String value = trim(rawBaseUrl);
        if (!StringUtils.hasText(value)) {
            return "";
        }
        try {
            URI uri = URI.create(value);
            String path = uri.getPath();
            String marker = OPEN_API_PREFIX + "/workspaces/";
            int index = path.indexOf(marker);
            if (index < 0) {
                return "";
            }
            String workspace = path.substring(index + marker.length());
            int slashIndex = workspace.indexOf('/');
            return slashIndex >= 0 ? workspace.substring(0, slashIndex) : workspace;
        } catch (IllegalArgumentException ignored) {
            return "";
        }
    }

    private Object executeObject(Request request, String failurePrefix) {
        try (Response response = httpClient.newCall(request).execute()) {
            String body = response.body() == null ? "" : response.body().string();
            if (!response.isSuccessful()) {
                throw status(toHttpStatus(response.code()), failurePrefix + ": " + extractRemoteMessage(body, response.message()));
            }
            if (body.isBlank()) {
                return Map.of();
            }
            if (!isJsonResponse(response.header("Content-Type"), body)) {
                throw status(HttpStatus.BAD_GATEWAY, failurePrefix + ": " + nonJsonResponseMessage(request, response, body));
            }
            Object parsed = objectMapper.readValue(body, Object.class);
            return validateMaxKbResponse(parsed);
        } catch (ResponseStatusException error) {
            throw error;
        } catch (IOException error) {
            throw status(HttpStatus.BAD_GATEWAY, failurePrefix + ": " + error.getMessage(), error);
        }
    }

    private Object validateMaxKbResponse(Object response) {
        if (response instanceof Map<?, ?> map) {
            Object code = map.get("code");
            if (code != null && !"200".equals(String.valueOf(code))) {
                Object message = firstPresent(map, "message", "msg", "detail", "error");
                throw status(HttpStatus.BAD_GATEWAY, "MaxKB 服务调用失败: " + (message == null ? "未知错误" : message));
            }
        }
        return response;
    }

    private boolean isJsonResponse(String contentType, String body) {
        if (StringUtils.hasText(contentType)) {
            String normalizedContentType = contentType.toLowerCase();
            if (normalizedContentType.contains("application/json") || normalizedContentType.contains("+json")) {
                return true;
            }
            if (normalizedContentType.contains("text/html")) {
                return false;
            }
        }
        String trimmedBody = body.trim();
        return trimmedBody.startsWith("{") || trimmedBody.startsWith("[");
    }

    private String nonJsonResponseMessage(Request request, Response response, String body) {
        String target = request.method() + " " + request.url().encodedPath();
        if (request.url().encodedQuery() != null) {
            target += "?" + request.url().encodedQuery();
        }
        String contentType = response.header("Content-Type");
        String responseType = StringUtils.hasText(contentType) ? contentType : "未知 Content-Type";
        String trimmedBody = body.trim();
        if (trimmedBody.startsWith("<")) {
            String routeHint = request.url().encodedPath().contains("/documents/upload")
                    ? "请确认该 MaxKB 服务已部署异步文档导入 OpenAPI，并且连接地址未被代理到前端页面。"
                    : "请确认该 MaxKB 服务地址指向 OpenAPI 后端，而不是前端页面。";
            return "MaxKB 返回了 HTML 页面，不是 OpenAPI JSON；" + routeHint + " 请求: " + target + "；响应类型: " + responseType;
        }
        return "MaxKB 返回了非 JSON 响应；请求: " + target + "；响应类型: " + responseType + "；响应片段: " + abbreviate(trimmedBody, 200);
    }

    private MaxKbAccount getAccount(Long accountId, boolean requireEnabled) {
        if (accountId == null) {
            throw status(HttpStatus.BAD_REQUEST, "MaxKB 账号 ID 不能为空");
        }
        MaxKbAccount account = maxKbAccountRepository.findById(accountId)
                .orElseThrow(() -> status(HttpStatus.NOT_FOUND, "MaxKB 账号不存在"));
        if (requireEnabled && !Integer.valueOf(1).equals(account.getStatus())) {
            throw status(HttpStatus.BAD_REQUEST, "MaxKB 账号已禁用");
        }
        if (requireEnabled) {
            validateAccountConfig(account);
        }
        return account;
    }

    private void validateAccountConfig(MaxKbAccount account) {
        if (!StringUtils.hasText(account.getBaseUrl())) {
            throw status(HttpStatus.BAD_REQUEST, "MaxKB 服务地址未配置");
        }
        if (!StringUtils.hasText(account.getApiKey())) {
            throw status(HttpStatus.BAD_REQUEST, "MaxKB OpenAPI Key 未配置");
        }
        if (!StringUtils.hasText(account.getWorkspaceId())) {
            throw status(HttpStatus.BAD_REQUEST, "MaxKB 工作空间 ID 未配置");
        }
    }

    private void addFilePart(MultipartBody.Builder bodyBuilder, MultipartFile file) {
        try {
            String filename = StringUtils.hasText(file.getOriginalFilename()) ? file.getOriginalFilename() : "document";
            MediaType mediaType = StringUtils.hasText(file.getContentType())
                    ? MediaType.parse(file.getContentType())
                    : OCTET_STREAM;
            if (mediaType == null) {
                mediaType = OCTET_STREAM;
            }
            bodyBuilder.addFormDataPart("file", filename, RequestBody.create(file.getBytes(), mediaType));
        } catch (IOException error) {
            throw status(HttpStatus.INTERNAL_SERVER_ERROR, "读取上传文件失败: " + error.getMessage(), error);
        }
    }

    private List<String> buildAssetPathCandidates(String assetPath) {
        String fileId = extractOssFileId(assetPath);
        Set<String> paths = new LinkedHashSet<>();
        paths.add("/admin/oss/file/" + fileId);
        paths.add("/oss/file/" + fileId);
        paths.add(assetPath);
        return new ArrayList<>(paths);
    }

    private String extractOssFileId(String assetPath) {
        String pathOnly = assetPath.split("\\?", 2)[0];
        String marker = "/oss/file/";
        int index = pathOnly.indexOf(marker);
        if (index < 0) {
            marker = "/.oss/file/";
            index = pathOnly.indexOf(marker);
        }
        if (index < 0) {
            throw status(HttpStatus.BAD_REQUEST, "MaxKB 图片路径不正确");
        }
        String fileId = pathOnly.substring(index + marker.length());
        int slashIndex = fileId.indexOf('/');
        if (slashIndex >= 0) {
            fileId = fileId.substring(0, slashIndex);
        }
        if (!StringUtils.hasText(fileId)) {
            throw status(HttpStatus.BAD_REQUEST, "MaxKB 图片 ID 不能为空");
        }
        return fileId;
    }

    private String normalizeAssetPath(MaxKbAccount account, String path) {
        if (!StringUtils.hasText(path)) {
            throw status(HttpStatus.BAD_REQUEST, "MaxKB 图片路径不能为空");
        }
        String value = path.trim();
        if (value.startsWith("http://") || value.startsWith("https://")) {
            URI source = URI.create(value);
            URI base = URI.create(normalizeServiceRootUrl(account.getBaseUrl()));
            if (!source.getScheme().equalsIgnoreCase(base.getScheme())
                    || !source.getHost().equalsIgnoreCase(base.getHost())
                    || source.getPort() != base.getPort()) {
                throw status(HttpStatus.BAD_REQUEST, "只允许代理当前 MaxKB 服务下的图片资源");
            }
            value = source.getRawPath() + (source.getRawQuery() == null ? "" : "?" + source.getRawQuery());
        }
        while (value.startsWith("./")) {
            value = value.substring(1);
        }
        if (!value.startsWith("/")) {
            value = "/" + value;
        }
        while (value.startsWith("/./")) {
            value = value.substring(2);
        }
        if (!isAllowedAssetPath(value)) {
            throw status(HttpStatus.BAD_REQUEST, "只允许代理 MaxKB /oss/file 或 /.oss/file 图片资源");
        }
        return value;
    }

    private boolean isAllowedAssetPath(String value) {
        return value.startsWith("/oss/file/")
                || value.startsWith("/.oss/file/")
                || value.startsWith("/admin/oss/file/")
                || value.contains("/oss/file/")
                || value.contains("/.oss/file/");
    }

    private Map<String, String> withDefaultDocumentTaskType(Map<String, String> queryParams) {
        Map<String, String> nextQueryParams = new LinkedHashMap<>();
        if (queryParams != null) {
            queryParams.forEach((key, value) -> {
                if (StringUtils.hasText(key) && StringUtils.hasText(value)) {
                    nextQueryParams.put(key, value);
                }
            });
        }
        nextQueryParams.putIfAbsent("task_type", DEFAULT_DOCUMENT_TASK_TYPE);
        return nextQueryParams;
    }

    private MaxKbKnowledgeDto.AccountVo toVo(MaxKbAccount account) {
        MaxKbKnowledgeDto.AccountVo vo = new MaxKbKnowledgeDto.AccountVo();
        vo.setId(account.getId());
        vo.setAccountName(account.getAccountName());
        vo.setBaseUrl(account.getBaseUrl());
        vo.setEnvironment(account.getEnvironment());
        vo.setEnvironmentText(environmentText(account.getEnvironment()));
        vo.setWorkspaceId(account.getWorkspaceId());
        vo.setRemark(account.getRemark());
        vo.setStatus(account.getStatus());
        vo.setStatusText(Integer.valueOf(1).equals(account.getStatus()) ? "启用" : "禁用");
        vo.setApiKeyConfigured(StringUtils.hasText(account.getApiKey()));
        vo.setApiKeyMasked(maskSecret(account.getApiKey()));
        vo.setCreateTime(account.getCreateTime() == null ? null : account.getCreateTime().format(DATE_TIME));
        vo.setUpdateTime(account.getUpdateTime() == null ? null : account.getUpdateTime().format(DATE_TIME));
        return vo;
    }

    private String normalizeEnvironment(String environment) {
        String value = trim(environment).toLowerCase();
        if (List.of("local", "test", "prod", "custom").contains(value)) {
            return value;
        }
        return "custom";
    }

    private String environmentText(String environment) {
        return switch (normalizeEnvironment(environment)) {
            case "local" -> "本地";
            case "test" -> "测试";
            case "prod" -> "线上";
            default -> "自定义";
        };
    }

    private Integer normalizeStatus(Integer status) {
        return Integer.valueOf(0).equals(status) ? 0 : 1;
    }

    private String requireId(String value, String label) {
        if (!StringUtils.hasText(value)) {
            throw status(HttpStatus.BAD_REQUEST, label + "不能为空");
        }
        return value.trim();
    }

    private HttpStatus toHttpStatus(int code) {
        try {
            return HttpStatus.valueOf(code);
        } catch (Exception ignored) {
            return HttpStatus.BAD_GATEWAY;
        }
    }

    private String extractRemoteMessage(String body, String fallback) {
        if (!StringUtils.hasText(body)) {
            return fallback;
        }
        try {
            Object parsed = objectMapper.readValue(body, Object.class);
            if (parsed instanceof Map<?, ?> map) {
                Object message = firstPresent(map, "detail", "message", "msg", "error");
                if (message != null) {
                    return message.toString();
                }
            }
        } catch (Exception ignored) {
        }
        return body;
    }

    private String abbreviate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, Math.max(0, maxLength)) + "...";
    }

    private Object firstPresent(Map<?, ?> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return "";
    }

    private String maskSecret(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 8) {
            return "****";
        }
        return trimmed.substring(0, 4) + "****" + trimmed.substring(trimmed.length() - 4);
    }

    private String trimToNull(String value) {
        String trimmed = trim(value);
        return trimmed.isBlank() ? null : trimmed;
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private String trimTrailingSlash(String value) {
        String trimmed = trim(value);
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private ResponseStatusException status(HttpStatus status, String reason) {
        return new ResponseStatusException(status, reason);
    }

    private ResponseStatusException status(HttpStatus status, String reason, Throwable cause) {
        return new ResponseStatusException(status, reason, cause);
    }

    private record MaxKbEndpoint(String baseUrl, String workspaceId) {
    }
}
