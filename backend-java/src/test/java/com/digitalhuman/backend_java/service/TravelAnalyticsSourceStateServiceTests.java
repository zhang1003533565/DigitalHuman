package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.TravelAnalyticsSourceState;
import com.digitalhuman.backend_java.repository.TravelAnalyticsSourceStateRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.calls;
import static org.mockito.Mockito.when;

class TravelAnalyticsSourceStateServiceTests {

    @Test
    void lockStateReturnsExistingLockedRow() {
        TravelAnalyticsSourceStateRepository repository = mock(TravelAnalyticsSourceStateRepository.class);
        TravelAnalyticsSourceState state = state(4L, 7L);
        when(repository.findLockedById(1L)).thenReturn(Optional.of(state));
        TravelAnalyticsSourceStateService service = new TravelAnalyticsSourceStateService(repository);

        TravelAnalyticsSourceState locked = service.lockState();

        assertSame(state, locked);
    }

    @Test
    void lockStateCreatesZeroVersionRowWhenDevelopmentSchemaHasNoSeedThenLocksIt() {
        TravelAnalyticsSourceStateRepository repository = mock(TravelAnalyticsSourceStateRepository.class);
        TravelAnalyticsSourceState persisted = state(0L, 0L);
        when(repository.findLockedById(1L))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(persisted));
        when(repository.saveAndFlush(any(TravelAnalyticsSourceState.class))).thenReturn(persisted);
        TravelAnalyticsSourceStateService service = new TravelAnalyticsSourceStateService(repository);

        TravelAnalyticsSourceState locked = service.lockState();

        assertSame(persisted, locked);
        ArgumentCaptor<TravelAnalyticsSourceState> captor = ArgumentCaptor.forClass(TravelAnalyticsSourceState.class);
        InOrder order = inOrder(repository);
        order.verify(repository, calls(2)).findLockedById(1L);
        order.verify(repository).saveAndFlush(captor.capture());
        order.verify(repository).findLockedById(1L);
        assertEquals(1L, captor.getValue().getId());
        assertEquals(0L, captor.getValue().getDataVersion());
        assertEquals(0L, captor.getValue().getMetricConfigVersion());
    }

    @Test
    void changeMarkersIncrementOnlyTheirOwnVersionExactlyOnce() {
        TravelAnalyticsSourceStateRepository repository = mock(TravelAnalyticsSourceStateRepository.class);
        TravelAnalyticsSourceStateService service = new TravelAnalyticsSourceStateService(repository);
        TravelAnalyticsSourceState state = state(4L, 7L);

        service.markDataChanged(state);
        service.markMetricConfigChanged(state);

        assertEquals(5L, state.getDataVersion());
        assertEquals(8L, state.getMetricConfigVersion());
    }

    @Test
    void versionValuesAreImmutableCopiesSuitableForComparison() {
        TravelAnalyticsSourceStateRepository repository = mock(TravelAnalyticsSourceStateRepository.class);
        TravelAnalyticsSourceStateService service = new TravelAnalyticsSourceStateService(repository);
        TravelAnalyticsSourceState state = state(4L, 7L);

        TravelAnalyticsSourceStateService.Versions versions = service.versionsOf(state);
        service.markDataChanged(state);
        service.markMetricConfigChanged(state);

        assertEquals(4L, versions.dataVersion());
        assertEquals(7L, versions.metricConfigVersion());
        assertEquals(new TravelAnalyticsSourceStateService.Versions(4L, 7L), versions);
    }

    private TravelAnalyticsSourceState state(long dataVersion, long metricConfigVersion) {
        TravelAnalyticsSourceState state = new TravelAnalyticsSourceState();
        state.setId(1L);
        state.setDataVersion(dataVersion);
        state.setMetricConfigVersion(metricConfigVersion);
        return state;
    }
}
