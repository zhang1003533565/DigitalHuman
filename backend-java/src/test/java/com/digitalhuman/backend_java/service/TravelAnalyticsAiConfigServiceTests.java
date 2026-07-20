package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.TravelAnalyticsAiConfig;
import com.digitalhuman.backend_java.model.TravelAnalyticsSourceState;
import com.digitalhuman.backend_java.repository.TravelAnalyticsAiConfigRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TravelAnalyticsAiConfigServiceTests {

    @Test
    void missingConfigReadsReturnInMemoryDefaultWithoutPersisting() {
        TravelAnalyticsAiConfigRepository repository = mock(TravelAnalyticsAiConfigRepository.class);
        TravelAnalyticsSourceStateService sourceStateService = mock(TravelAnalyticsSourceStateService.class);
        when(repository.findById("default")).thenReturn(Optional.empty());
        TravelAnalyticsAiConfigService service = new TravelAnalyticsAiConfigService(repository, sourceStateService);

        TravelAnalyticsAiConfig first = service.getConfig();
        TravelAnalyticsAiConfig second = service.getConfig();

        assertEquals("default", first.getId());
        assertTrue(first.getPublicEnabled());
        assertEquals(10, first.getMinimumSampleSize());
        assertEquals("default", second.getId());
        verify(repository, never()).save(any(TravelAnalyticsAiConfig.class));
    }

    @Test
    void minimumSampleSizeChangeLocksBeforeWriteAndMarksMetricConfigChanged() {
        TravelAnalyticsAiConfigRepository repository = mock(TravelAnalyticsAiConfigRepository.class);
        TravelAnalyticsSourceStateService sourceStateService = mock(TravelAnalyticsSourceStateService.class);
        TravelAnalyticsSourceState lockedState = new TravelAnalyticsSourceState();
        when(sourceStateService.lockState()).thenReturn(lockedState);
        when(repository.findById("default")).thenReturn(Optional.empty());
        when(repository.save(any(TravelAnalyticsAiConfig.class))).thenAnswer(invocation -> invocation.getArgument(0));
        TravelAnalyticsAiConfigService service = new TravelAnalyticsAiConfigService(repository, sourceStateService);

        TravelAnalyticsAiConfig updated = service.updateConfig(false, 25);

        assertEquals("default", updated.getId());
        assertEquals(false, updated.getPublicEnabled());
        assertEquals(25, updated.getMinimumSampleSize());
        var order = inOrder(sourceStateService, repository);
        order.verify(sourceStateService).lockState();
        order.verify(repository).save(any(TravelAnalyticsAiConfig.class));
        order.verify(sourceStateService).markMetricConfigChanged(lockedState);
        verify(sourceStateService, times(1)).markMetricConfigChanged(lockedState);
    }

    @Test
    void publicEnabledOnlyChangeDoesNotIncrementMetricConfigVersion() {
        TravelAnalyticsAiConfigRepository repository = mock(TravelAnalyticsAiConfigRepository.class);
        TravelAnalyticsSourceStateService sourceStateService = mock(TravelAnalyticsSourceStateService.class);
        TravelAnalyticsSourceState lockedState = new TravelAnalyticsSourceState();
        when(sourceStateService.lockState()).thenReturn(lockedState);
        TravelAnalyticsAiConfig existing = new TravelAnalyticsAiConfig();
        existing.setId("default");
        existing.setPublicEnabled(true);
        existing.setMinimumSampleSize(10);
        when(repository.findById("default")).thenReturn(Optional.of(existing));
        when(repository.save(any(TravelAnalyticsAiConfig.class))).thenAnswer(invocation -> invocation.getArgument(0));
        TravelAnalyticsAiConfigService service = new TravelAnalyticsAiConfigService(repository, sourceStateService);

        TravelAnalyticsAiConfig updated = service.updateConfig(false, 10);

        assertEquals(false, updated.getPublicEnabled());
        verify(sourceStateService).lockState();
        verify(repository).save(existing);
        verify(sourceStateService, never()).markMetricConfigChanged(any());
    }

    @Test
    void rejectedConfigDoesNotLockOrIncrementVersion() {
        TravelAnalyticsAiConfigRepository repository = mock(TravelAnalyticsAiConfigRepository.class);
        TravelAnalyticsSourceStateService sourceStateService = mock(TravelAnalyticsSourceStateService.class);
        TravelAnalyticsAiConfigService service = new TravelAnalyticsAiConfigService(repository, sourceStateService);

        org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> service.updateConfig(true, 0));

        verify(sourceStateService, never()).lockState();
        verify(sourceStateService, never()).markMetricConfigChanged(any());
    }
}
