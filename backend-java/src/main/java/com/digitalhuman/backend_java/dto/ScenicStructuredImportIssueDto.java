package com.digitalhuman.backend_java.dto;

public class ScenicStructuredImportIssueDto {

    private final int rowNumber;
    private final String reason;

    public ScenicStructuredImportIssueDto(int rowNumber, String reason) {
        this.rowNumber = rowNumber;
        this.reason = reason;
    }

    public int getRowNumber() {
        return rowNumber;
    }

    public String getReason() {
        return reason;
    }
}
