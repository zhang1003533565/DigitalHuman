package com.digitalhuman.backend_java.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record MallOrderDto(
        String id,
        Long userId,
        String username,
        String displayName,
        String status,
        String statusLabel,
        BigDecimal totalAmount,
        Integer itemCount,
        String receiverName,
        String receiverPhone,
        String receiverAddress,
        String remark,
        String cancelReason,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<MallOrderItemDto> items) {
}
