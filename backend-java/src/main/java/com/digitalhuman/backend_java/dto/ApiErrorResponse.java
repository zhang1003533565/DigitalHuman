package com.digitalhuman.backend_java.dto;

/**
 * 统一错误响应体。前端（游客端 getApiProblem / 管理端 axios 错误处理）
 * 读取 message 与 traceId 字段，因此错误响应必须显式返回它们。
 */
public record ApiErrorResponse(String code, String message, String traceId) {
}
