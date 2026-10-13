package com.digitalhuman.backend_java.dto;

import java.math.BigDecimal;

public record MallOrderItemDto(
        String productId,
        String productName,
        String productImage,
        BigDecimal unitPrice,
        Integer quantity,
        BigDecimal subtotal) {
}
