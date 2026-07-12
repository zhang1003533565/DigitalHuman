package com.digitalhuman.backend_java.config;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class TraceIdFilter extends OncePerRequestFilter {

    public static final String TRACE_ID_HEADER = "X-Trace-Id";
    private static final Pattern VALID_TRACE_ID = Pattern.compile("[A-Za-z0-9._:-]{8,128}");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String requestedTraceId = request.getHeader(TRACE_ID_HEADER);
        String traceId = isValid(requestedTraceId) ? requestedTraceId : UUID.randomUUID().toString();
        response.setHeader(TRACE_ID_HEADER, traceId);
        filterChain.doFilter(request, response);
    }

    private boolean isValid(String traceId) {
        return traceId != null && VALID_TRACE_ID.matcher(traceId).matches();
    }
}
