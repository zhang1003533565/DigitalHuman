package com.digitalhuman.backend_java.dto;

import com.digitalhuman.backend_java.model.TravelAnalyticsRecord;

import java.util.List;

public class TravelAnalyticsPageResponse {

    private final List<TravelAnalyticsRecord> records;
    private final long total;
    private final int page;
    private final int size;

    public TravelAnalyticsPageResponse(List<TravelAnalyticsRecord> records, long total, int page, int size) {
        this.records = records;
        this.total = total;
        this.page = page;
        this.size = size;
    }

    public List<TravelAnalyticsRecord> getRecords() {
        return records;
    }

    public long getTotal() {
        return total;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }
}
