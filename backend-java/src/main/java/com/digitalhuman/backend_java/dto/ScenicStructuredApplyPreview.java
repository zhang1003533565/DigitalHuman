package com.digitalhuman.backend_java.dto;

import java.util.List;

public class ScenicStructuredApplyPreview {
    private Long recordId;
    private Long facilityId;
    private List<FieldDiff> fields;

    public ScenicStructuredApplyPreview(Long recordId, Long facilityId, List<FieldDiff> fields) {
        this.recordId = recordId;
        this.facilityId = facilityId;
        this.fields = fields;
    }

    public Long getRecordId() { return recordId; }
    public Long getFacilityId() { return facilityId; }
    public List<FieldDiff> getFields() { return fields; }

    public static class FieldDiff {
        private final String key;
        private final String label;
        private final String currentValue;
        private final String importedValue;
        private final boolean changed;

        public FieldDiff(String key, String label, String currentValue, String importedValue) {
            this.key = key;
            this.label = label;
            this.currentValue = currentValue == null ? "" : currentValue;
            this.importedValue = importedValue == null ? "" : importedValue;
            this.changed = !this.currentValue.equals(this.importedValue);
        }

        public String getKey() { return key; }
        public String getLabel() { return label; }
        public String getCurrentValue() { return currentValue; }
        public String getImportedValue() { return importedValue; }
        public boolean isChanged() { return changed; }
    }
}
