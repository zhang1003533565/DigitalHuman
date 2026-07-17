package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.DigitalHumanConfigDto;
import com.digitalhuman.backend_java.dto.MapConfigDto;
import com.digitalhuman.backend_java.model.DigitalHumanConfig;
import com.digitalhuman.backend_java.repository.DigitalHumanConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DigitalHumanConfigService {
    private static final Long CONFIG_ID = 1L;

    private final DigitalHumanConfigRepository repository;

    public DigitalHumanConfigService(DigitalHumanConfigRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public DigitalHumanConfigDto getConfig() {
        return toDto(loadConfig());
    }

    @Transactional(readOnly = true)
    public MapConfigDto getMapConfig() {
        DigitalHumanConfig config = loadConfig();
        return toMapDto(config);
    }

    @Transactional
    public DigitalHumanConfigDto updateConfig(DigitalHumanConfigDto request) {
        DigitalHumanConfig config = loadConfig();
        config.setModelId(normalize(request.getModelId(), config.getModelId()));
        config.setCostumeId(normalize(request.getCostumeId(), config.getCostumeId()));
        config.setVoiceId(normalize(request.getVoiceId(), config.getVoiceId()));
        config.setRate(clamp(request.getRate(), -50, 100, config.getRate()));
        config.setVolume(clamp(request.getVolume(), -50, 50, config.getVolume()));
        config.setPitch(clamp(request.getPitch(), -50, 50, config.getPitch()));
        config.setWelcomeText(normalize(request.getWelcomeText(), config.getWelcomeText()));
        config.setGuideStyle(normalize(request.getGuideStyle(), config.getGuideStyle()));
        config.setBroadcastStrategy(normalize(request.getBroadcastStrategy(), config.getBroadcastStrategy()));
        return toDto(repository.save(config));
    }

    @Transactional
    public MapConfigDto updateMapConfig(MapConfigDto request) {
        DigitalHumanConfig config = loadConfig();
        config.setAmapKey(normalizeBlankToEmpty(request.getAmapKey()));
        config.setAmapSecurityKey(normalizeBlankToEmpty(request.getAmapSecurityKey()));
        return toMapDto(repository.save(config));
    }

    private DigitalHumanConfig loadConfig() {
        return repository.findById(CONFIG_ID).orElseGet(() -> {
            DigitalHumanConfig config = new DigitalHumanConfig();
            config.setId(CONFIG_ID);
            return repository.save(config);
        });
    }

    private DigitalHumanConfigDto toDto(DigitalHumanConfig config) {
        return new DigitalHumanConfigDto(
                config.getModelId(),
                config.getCostumeId(),
                config.getVoiceId(),
                config.getRate(),
                config.getVolume(),
                config.getPitch(),
                config.getWelcomeText(),
                config.getGuideStyle(),
                config.getBroadcastStrategy()
        );
    }

    private MapConfigDto toMapDto(DigitalHumanConfig config) {
        return new MapConfigDto(config.getAmapKey(), config.getAmapSecurityKey());
    }

    private String normalize(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    private String normalizeBlankToEmpty(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.trim();
    }

    private Integer clamp(Integer value, int min, int max, Integer fallback) {
        if (value == null) {
            return fallback;
        }
        return Math.max(min, Math.min(max, value));
    }
}
