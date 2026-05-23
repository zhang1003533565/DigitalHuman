package com.digitalhuman.backend_java.dto;

public class AdminProviderDocDto {

    private String provider;
    private String fileName;
    private String markdown;

    public AdminProviderDocDto() {
    }

    public AdminProviderDocDto(String provider, String fileName, String markdown) {
        this.provider = provider;
        this.fileName = fileName;
        this.markdown = markdown;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getMarkdown() {
        return markdown;
    }

    public void setMarkdown(String markdown) {
        this.markdown = markdown;
    }
}
