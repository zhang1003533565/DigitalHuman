package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public class MallProductSaveRequest {

    private String id;

    @NotBlank(message = "商品名称不能为空")
    @Size(max = 120, message = "商品名称不能超过120个字符")
    private String name;

    @NotBlank(message = "商品分类不能为空")
    @Size(max = 50, message = "商品分类不能超过50个字符")
    private String category;

    @NotNull(message = "商品价格不能为空")
    @DecimalMin(value = "0.00", message = "商品价格不能为负数")
    private BigDecimal price;

    @DecimalMin(value = "0.00", message = "划线价不能为负数")
    private BigDecimal originalPrice;

    @Size(max = 20, message = "单位不能超过20个字符")
    private String unit;

    @Min(value = 0, message = "库存不能为负数")
    private Integer stock;

    @Size(max = 500, message = "图片地址不能超过500个字符")
    private String image;

    @Size(max = 255, message = "简介不能超过255个字符")
    private String summary;

    private String description;

    @Size(max = 255, message = "标签不能超过255个字符")
    private String tags;

    private Integer sortOrder;

    private Boolean enabled;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public BigDecimal getOriginalPrice() {
        return originalPrice;
    }

    public void setOriginalPrice(BigDecimal originalPrice) {
        this.originalPrice = originalPrice;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public Integer getStock() {
        return stock;
    }

    public void setStock(Integer stock) {
        this.stock = stock;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }
}
