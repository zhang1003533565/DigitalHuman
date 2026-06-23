package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class TravelTipSaveRequest {

    private String id;

    @NotBlank(message = "标题不能为空")
    @Size(max = 120, message = "标题不能超过120个字符")
    private String title;

    @NotBlank(message = "分类不能为空")
    @Size(max = 50, message = "分类不能超过50个字符")
    private String category;

    @NotBlank(message = "内容不能为空")
    private String content;

    @Size(max = 50, message = "图标不能超过50个字符")
    private String icon;

    private Integer sortOrder;

    private Boolean enabled;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getIcon() {
        return icon;
    }

    public void setIcon(String icon) {
        this.icon = icon;
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
