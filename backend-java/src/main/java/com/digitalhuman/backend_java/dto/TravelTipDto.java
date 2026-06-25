package com.digitalhuman.backend_java.dto;

public class TravelTipDto {

    private final String id;
    private final String title;
    private final String category;
    private final String content;
    private final String icon;
    private final Integer sortOrder;
    private final Boolean enabled;

    public TravelTipDto(String id, String title, String category, String content,
                        String icon, Integer sortOrder, Boolean enabled) {
        this.id = id;
        this.title = title;
        this.category = category;
        this.content = content;
        this.icon = icon;
        this.sortOrder = sortOrder;
        this.enabled = enabled;
    }

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getCategory() {
        return category;
    }

    public String getContent() {
        return content;
    }

    public String getIcon() {
        return icon;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public Boolean getEnabled() {
        return enabled;
    }
}
