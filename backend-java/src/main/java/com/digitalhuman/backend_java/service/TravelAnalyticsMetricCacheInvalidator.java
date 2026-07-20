package com.digitalhuman.backend_java.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class TravelAnalyticsMetricCacheInvalidator {

    private final TravelAnalyticsMetricCache metricCache;

    public TravelAnalyticsMetricCacheInvalidator(TravelAnalyticsMetricCache metricCache) {
        this.metricCache = metricCache;
    }

    public void invalidateAfterCommitOrNow() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            metricCache.invalidateAll();
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                metricCache.invalidateAll();
            }
        });
    }
}
