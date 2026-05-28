package com.digitalhuman.backend_java.dto;

public class AgentCatalogItemDto {

    private String name;
    private String soul;
    private String skill;
    private String categoryHint;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSoul() {
        return soul;
    }

    public void setSoul(String soul) {
        this.soul = soul;
    }

    public String getSkill() {
        return skill;
    }

    public void setSkill(String skill) {
        this.skill = skill;
    }

    public String getCategoryHint() {
        return categoryHint;
    }

    public void setCategoryHint(String categoryHint) {
        this.categoryHint = categoryHint;
    }
}
