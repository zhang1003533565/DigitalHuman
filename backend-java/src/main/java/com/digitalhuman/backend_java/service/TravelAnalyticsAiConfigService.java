package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.TravelAnalyticsAiConfig;
import com.digitalhuman.backend_java.repository.TravelAnalyticsAiConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class TravelAnalyticsAiConfigService {

    private static final String DEFAULT_ID = "default";
    private static final int DEFAULT_MINIMUM_SAMPLE_SIZE = 10;

    private final TravelAnalyticsAiConfigRepository repository;

    public TravelAnalyticsAiConfigService(TravelAnalyticsAiConfigRepository repository) {
        this.repository = repository;
    }

    public TravelAnalyticsAiConfig getConfig() {
        return repository.findById(DEFAULT_ID).orElseGet(this::createDefaultConfig);
    }

    public TravelAnalyticsAiConfig updateConfig(Boolean publicEnabled, Integer minimumSampleSize) {
        if (publicEnabled == null) {
            throw new ResponseStatusException(BAD_REQUEST, "publicEnabled 不能为空");
        }
        if (minimumSampleSize == null || minimumSampleSize < 1) {
            throw new ResponseStatusException(BAD_REQUEST, "minimumSampleSize 必须大于 0");
        }

        TravelAnalyticsAiConfig config = getConfig();
        config.setPublicEnabled(publicEnabled);
        config.setMinimumSampleSize(minimumSampleSize);
        config.setUpdatedAt(LocalDateTime.now());
        return repository.save(config);
    }

    private TravelAnalyticsAiConfig createDefaultConfig() {
        TravelAnalyticsAiConfig config = new TravelAnalyticsAiConfig();
        config.setId(DEFAULT_ID);
        config.setPublicEnabled(true);
        config.setMinimumSampleSize(DEFAULT_MINIMUM_SAMPLE_SIZE);
        config.setUpdatedAt(LocalDateTime.now());
        return repository.save(config);
    }
}
