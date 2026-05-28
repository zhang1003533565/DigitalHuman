package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.HomeConfig;
import com.digitalhuman.backend_java.model.HomeConfigType;
import com.digitalhuman.backend_java.repository.HomeConfigRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class HomeConfigService {

    private final HomeConfigRepository repository;

    public HomeConfigService(HomeConfigRepository repository) {
        this.repository = repository;
    }

    public List<HomeConfig> listByType(HomeConfigType type) {
        return repository.findByTypeOrderBySortOrderAsc(type);
    }

    public List<HomeConfig> listEnabledByType(HomeConfigType type) {
        return repository.findByTypeAndEnabledTrueOrderBySortOrderAsc(type);
    }

    public List<HomeConfig> listAllEnabled() {
        return repository.findByEnabledTrueOrderByTypeAscSortOrderAsc();
    }

    public List<HomeConfig> listAll() {
        return repository.findAll();
    }

    public HomeConfig save(HomeConfig config) {
        if (config.getId() == null || config.getId().isBlank()) {
            config.setId(UUID.randomUUID().toString());
            config.setCreatedAt(LocalDateTime.now());
        }
        return repository.save(config);
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    public HomeConfig toggleEnabled(String id, boolean enabled) {
        HomeConfig config = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("HomeConfig not found: " + id));
        config.setEnabled(enabled);
        return repository.save(config);
    }
}
