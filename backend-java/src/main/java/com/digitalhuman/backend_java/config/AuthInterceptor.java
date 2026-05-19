package com.digitalhuman.backend_java.config;

import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.service.AuthTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    public static final String REQUEST_ATTR_AUTH_SESSION = "AUTH_SESSION";

    private final AuthTokenService authTokenService;

    public AuthInterceptor(AuthTokenService authTokenService) {
        this.authTokenService = authTokenService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String token = resolveToken(request);
        if (token == null) {
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "未登录");
            return false;
        }

        AuthSession session = authTokenService.getSession(token).orElse(null);
        if (session == null) {
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "登录已失效");
            return false;
        }

        String path = request.getRequestURI();
        if (path.startsWith("/api/admin/") && session.getRole() != UserRole.ADMIN) {
            response.sendError(HttpStatus.FORBIDDEN.value(), "需要管理员权限");
            return false;
        }

        if (path.startsWith("/api/user/") && session.getRole() != UserRole.USER) {
            response.sendError(HttpStatus.FORBIDDEN.value(), "需要用户权限");
            return false;
        }

        request.setAttribute(REQUEST_ATTR_AUTH_SESSION, session);
        return true;
    }

    private String resolveToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7).trim();
        }

        String token = request.getHeader("X-Auth-Token");
        if (token != null && !token.isBlank()) {
            return token.trim();
        }

        return null;
    }
}
