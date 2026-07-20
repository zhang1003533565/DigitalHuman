package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.TravelAnalyticsSourceState;
import com.digitalhuman.backend_java.repository.TravelAnalyticsSourceStateRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

@Service
public class TravelAnalyticsSourceStateService {

    private static final long SOURCE_STATE_ID = 1L;
    private static final Object INITIALIZATION_MONITOR = new Object();

    private final TravelAnalyticsSourceStateRepository repository;

    public TravelAnalyticsSourceStateService(TravelAnalyticsSourceStateRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public TravelAnalyticsSourceState lockState() {
        return repository.findLockedById(SOURCE_STATE_ID).orElseGet(this::initializeAndLockState);
    }

    public void markDataChanged(TravelAnalyticsSourceState state) {
        state.setDataVersion(state.getDataVersion() + 1L);
    }

    public void markMetricConfigChanged(TravelAnalyticsSourceState state) {
        state.setMetricConfigVersion(state.getMetricConfigVersion() + 1L);
    }

    public Versions versionsOf(TravelAnalyticsSourceState state) {
        return new Versions(state.getDataVersion(), state.getMetricConfigVersion());
    }

    private TravelAnalyticsSourceState initializeAndLockState() {
        synchronized (INITIALIZATION_MONITOR) {
            return repository.findLockedById(SOURCE_STATE_ID).orElseGet(() -> {
                TravelAnalyticsSourceState state = new TravelAnalyticsSourceState();
                state.setId(SOURCE_STATE_ID);
                state.setDataVersion(0L);
                state.setMetricConfigVersion(0L);
                repository.saveAndFlush(state);
                return repository.findLockedById(SOURCE_STATE_ID)
                        .orElseThrow(() -> new IllegalStateException("旅游统计来源状态初始化失败"));
            });
        }
    }

    public record Versions(long dataVersion, long metricConfigVersion) {
    }
}
