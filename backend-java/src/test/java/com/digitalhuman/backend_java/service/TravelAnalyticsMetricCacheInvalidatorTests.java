package com.digitalhuman.backend_java.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class TravelAnalyticsMetricCacheInvalidatorTests {

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void clearsImmediatelyWhenNoTransactionSynchronizationIsActive() {
        TravelAnalyticsMetricCache cache = mock(TravelAnalyticsMetricCache.class);
        TravelAnalyticsMetricCacheInvalidator invalidator = new TravelAnalyticsMetricCacheInvalidator(cache);

        invalidator.invalidateAfterCommitOrNow();

        verify(cache).invalidateAll();
    }

    @Test
    void doesNotClearBeforeCommitWhenSynchronizationIsActive() {
        TravelAnalyticsMetricCache cache = mock(TravelAnalyticsMetricCache.class);
        TravelAnalyticsMetricCacheInvalidator invalidator = new TravelAnalyticsMetricCacheInvalidator(cache);
        TransactionSynchronizationManager.initSynchronization();

        invalidator.invalidateAfterCommitOrNow();

        verify(cache, never()).invalidateAll();
    }

    @Test
    void afterCommitClearsExactlyOnce() {
        TravelAnalyticsMetricCache cache = mock(TravelAnalyticsMetricCache.class);
        TravelAnalyticsMetricCacheInvalidator invalidator = new TravelAnalyticsMetricCacheInvalidator(cache);
        TransactionSynchronizationManager.initSynchronization();

        invalidator.invalidateAfterCommitOrNow();

        TransactionSynchronization synchronization = TransactionSynchronizationManager.getSynchronizations().get(0);
        synchronization.beforeCompletion();
        synchronization.afterCommit();
        synchronization.afterCompletion(TransactionSynchronization.STATUS_COMMITTED);

        verify(cache, times(1)).invalidateAll();
    }

    @Test
    void rollbackCompletionWithoutAfterCommitDoesNotClear() {
        TravelAnalyticsMetricCache cache = mock(TravelAnalyticsMetricCache.class);
        TravelAnalyticsMetricCacheInvalidator invalidator = new TravelAnalyticsMetricCacheInvalidator(cache);
        TransactionSynchronizationManager.initSynchronization();

        invalidator.invalidateAfterCommitOrNow();

        TransactionSynchronization synchronization = TransactionSynchronizationManager.getSynchronizations().get(0);
        synchronization.beforeCompletion();
        synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);

        verify(cache, never()).invalidateAll();
    }
}
