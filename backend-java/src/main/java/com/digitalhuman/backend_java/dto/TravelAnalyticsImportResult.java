package com.digitalhuman.backend_java.dto;

import java.util.List;

public class TravelAnalyticsImportResult {

    private final int importedCount;
    private final int skippedEmptyCount;
    private final int skippedDuplicateCount;
    private final List<TravelAnalyticsImportIssueDto> issues;

    public TravelAnalyticsImportResult(
            int importedCount,
            int skippedEmptyCount,
            int skippedDuplicateCount,
            List<TravelAnalyticsImportIssueDto> issues) {
        this.importedCount = importedCount;
        this.skippedEmptyCount = skippedEmptyCount;
        this.skippedDuplicateCount = skippedDuplicateCount;
        this.issues = issues;
    }

    public int getImportedCount() {
        return importedCount;
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
