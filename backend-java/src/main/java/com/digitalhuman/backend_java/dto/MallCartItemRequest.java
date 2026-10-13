package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public class MallCartItemRequest {

    @NotBlank(message = "商品 ID 不能为空")
    private String productId;

    @Min(value = 1, message = "购买数量至少为 1")
    @Max(value = 99, message = "单件商品最多购买 99 件")
    private Integer quantity;

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }
}
