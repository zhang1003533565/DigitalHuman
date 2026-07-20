package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.config.AuthInterceptor;
import com.digitalhuman.backend_java.dto.ScenicKnowledgePreviewDto;
import com.digitalhuman.backend_java.dto.ScenicKnowledgePublicationDto;
import com.digitalhuman.backend_java.dto.ScenicKnowledgePublishRequest;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.service.ScenicKnowledgePublicationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/scenic-knowledge")
public class AdminScenicKnowledgePublicationController {

    private final ScenicKnowledgePublicationService publicationService;

    public AdminScenicKnowledgePublicationController(ScenicKnowledgePublicationService publicationService) {
        this.publicationService = publicationService;
    }

    @GetMapping("/records/{recordId}/preview")
    public ScenicKnowledgePreviewDto preview(@PathVariable Long recordId) {
        return publicationService.preview(recordId);
    }

    @PostMapping("/records/{recordId}/publish")
    public ScenicKnowledgePublicationDto publish(
            @PathVariable Long recordId,
            @RequestBody ScenicKnowledgePublishRequest request,
            HttpServletRequest servletRequest) {
        return publicationService.publish(recordId, request, requireAdmin(servletRequest));
    }

    @GetMapping("/facilities/{facilityId}/status")
    public ScenicKnowledgePublicationDto getStatus(@PathVariable Long facilityId) {
        return publicationService.getStatus(facilityId);
    }

    @PostMapping("/facilities/{facilityId}/withdraw")
    public ScenicKnowledgePublicationDto withdraw(@PathVariable Long facilityId, HttpServletRequest servletRequest) {
        return publicationService.withdraw(facilityId, requireAdmin(servletRequest));
    }

    private AuthSession requireAdmin(HttpServletRequest request) {
        Object session = request.getAttribute(AuthInterceptor.REQUEST_ATTR_AUTH_SESSION);
        if (!(session instanceof AuthSession authSession)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        if (authSession.getRole() != UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权限操作，仅管理员可执行");
        }
        return authSession;
    }
}
