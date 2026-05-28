package com.digitalhuman.backend_java.dto;

import java.util.List;

public class VoiceScriptImportResponse {

    private final int importedCount;
    private final int totalCount;
    private final int skippedCount;
    private final List<VoiceScriptImportIssueDto> issues;

    public VoiceScriptImportResponse(int importedCount, int totalCount, int skippedCount, List<VoiceScriptImportIssueDto> issues) {
        this.importedCount = importedCount;
        this.totalCount = totalCount;
        this.skippedCount = skippedCount;
        this.issues = issues;
    }

    public int getImportedCount() {
        return importedCount;
    }

    public int getTotalCount() {
        return totalCount;
    }

    public int getSkippedCount() {
        return skippedCount;
    }

    public List<VoiceScriptImportIssueDto> getIssues() {
        return issues;
    }
}
