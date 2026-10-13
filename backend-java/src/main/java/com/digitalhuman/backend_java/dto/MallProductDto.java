package com.digitalhuman.backend_java.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record MallProductDto(
        String id,
        String name,
        String category,
        String categoryLabel,
        BigDecimal price,
        BigDecimal originalPrice,
        String unit,
        Integer stock,
        String image,
        String summary,
        String description,
        String tags,
        Integer sortOrder,
        Boolean enabled,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
