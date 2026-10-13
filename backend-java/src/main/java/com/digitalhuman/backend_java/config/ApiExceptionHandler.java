package com.digitalhuman.backend_java.config;

import com.digitalhuman.backend_java.dto.ApiErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.stream.Collectors;

/**
 * 把业务异常与校验异常统一成 {code, message, traceId} 响应体。
 *
 * <p>背景：项目原先依赖 {@code server.error.include-message: always} 让 Spring Boot 的
 * /error 端点回显 ResponseStatusException 的 reason，但实际响应体里只有
 * timestamp/status/error/path，没有任何 message 字段。前端 getApiProblem 只认
 * payload.message 与 payload.detail，于是所有业务提示（例如"库存不足"、"请输入 11 位手机号"）
 * 都会退化成通用兜底文案。这里显式返回 message，避免依赖该配置项。
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleResponseStatus(ResponseStatusException exception) {
        HttpStatus status = HttpStatus.resolve(exception.getStatusCode().value());
        HttpStatus resolved = status == null ? HttpStatus.INTERNAL_SERVER_ERROR : status;
        String message = exception.getReason() != null ? exception.getReason() : resolved.getReasonPhrase();
        return ResponseEntity.status(resolved)
                .body(new ApiErrorResponse(codeOf(resolved), message, TraceIdFilter.currentTraceId()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .filter(text -> text != null && !text.isBlank())
                .distinct()
                .collect(Collectors.joining("；"));
        if (message.isBlank()) {
            message = "请求参数有误";
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiErrorResponse("VALIDATION_FAILED", message, TraceIdFilter.currentTraceId()));
    }

    private String codeOf(HttpStatus status) {
        return switch (status) {
            case BAD_REQUEST -> "BAD_REQUEST";
            case UNAUTHORIZED -> "UNAUTHORIZED";
            case FORBIDDEN -> "FORBIDDEN";
            case NOT_FOUND -> "NOT_FOUND";
            case CONFLICT -> "CONFLICT";
            default -> "INTERNAL_ERROR";
        };
    }
}
