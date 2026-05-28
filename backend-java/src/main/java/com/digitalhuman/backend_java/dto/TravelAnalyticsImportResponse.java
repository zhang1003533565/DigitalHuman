package com.digitalhuman.backend_java.dto;

import java.util.List;

public class TravelAnalyticsImportResponse {

    private final int importedCount;
    private final int totalCount;
    private final int skippedEmptyCount;
    private final int skippedDuplicateCount;
    private final List<TravelAnalyticsImportIssueDto> issues;

    public TravelAnalyticsImportResponse(
            int importedCount,
            int totalCount,
            int skippedEmptyCount,
            int skippedDuplicateCount,
            List<TravelAnalyticsImportIssueDto> issues) {
        this.importedCount = importedCount;
        this.totalCount = totalCount;
        this.skippedEmptyCount = skippedEmptyCount;
        this.skippedDuplicateCount = skippedDuplicateCount;
        this.issues = issues;
    }

    public int getImportedCount() {
        return importedCount;
    }

    public int getTotalCount() {
        return totalCount;
    }

    public int getSkippedEmptyCount() {
        return skippedEmptyCount;
    }

    public int getSkippedDuplicateCount() {
        return skippedDuplicateCount;
    }

    public List<TravelAnalyticsImportIssueDto> getIssues() {
        return issues;
    }
}
