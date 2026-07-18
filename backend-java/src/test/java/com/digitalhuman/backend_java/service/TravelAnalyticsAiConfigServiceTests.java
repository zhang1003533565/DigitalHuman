package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.TravelAnalyticsAiConfig;
import com.digitalhuman.backend_java.repository.TravelAnalyticsAiConfigRepository;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TravelAnalyticsAiConfigServiceTests {

    @Test
    void missingConfigReadsReturnInMemoryDefaultWithoutPersisting() {
        TravelAnalyticsAiConfigRepository repository = mock(TravelAnalyticsAiConfigRepository.class);
        when(repository.findById("default")).thenReturn(Optional.empty());
        TravelAnalyticsAiConfigService service = new TravelAnalyticsAiConfigService(repository);

        TravelAnalyticsAiConfig first = service.getConfig();
        TravelAnalyticsAiConfig second = service.getConfig();

        assertEquals("default", first.getId());
        assertTrue(first.getPublicEnabled());
        assertEquals(10, first.getMinimumSampleSize());
        assertEquals("default", second.getId());
        verify(repository, never()).save(any(TravelAnalyticsAiConfig.class));
    }

    @Test
    void updatePersistsDefaultIdWhenRowIsMissing() {
        TravelAnalyticsAiConfigRepository repository = mock(TravelAnalyticsAiConfigRepository.class);
        TravelAnalyticsMetricCacheInvalidator invalidator = mock(TravelAnalyticsMetricCacheInvalidator.class);
        when(repository.findById("default")).thenReturn(Optional.empty());
        when(repository.save(any(TravelAnalyticsAiConfig.class))).thenAnswer(invocation -> invocation.getArgument(0));
        TravelAnalyticsAiConfigService service = new TravelAnalyticsAiConfigService(repository, invalidator);

        TravelAnalyticsAiConfig updated = service.updateConfig(false, 25);

        assertEquals("default", updated.getId());
        assertEquals(false, updated.getPublicEnabled());
        assertEquals(25, updated.getMinimumSampleSize());
        verify(repository).save(any(TravelAnalyticsAiConfig.class));
        verify(invalidator).invalidateAfterCommitOrNow();
    }

    @Test
    void updateDefersCacheInvalidationUntilAfterCommitWhenSynchronizationIsActive() {
        TravelAnalyticsAiConfigRepository repository = mock(TravelAnalyticsAiConfigRepository.class);
        TravelAnalyticsMetricCache cache = mock(TravelAnalyticsMetricCache.class);
        when(repository.findById("default")).thenReturn(Optional.empty());
        when(repository.save(any(TravelAnalyticsAiConfig.class))).thenAnswer(invocation -> invocation.getArgument(0));
        TravelAnalyticsAiConfigService service = new TravelAnalyticsAiConfigService(
                repository,
                new TravelAnalyticsMetricCacheInvalidator(cache));
        TransactionSynchronizationManager.initSynchronization();

        try {
            service.updateConfig(false, 25);

            verify(cache, never()).invalidateAll();
            TransactionSynchronization synchronization = TransactionSynchronizationManager.getSynchronizations().get(0);
            synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
            verify(cache, never()).invalidateAll();
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }
}
