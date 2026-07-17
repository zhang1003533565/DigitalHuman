package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.MapConfigDto;
import com.digitalhuman.backend_java.model.DigitalHumanConfig;
import com.digitalhuman.backend_java.repository.DigitalHumanConfigRepository;
import com.digitalhuman.backend_java.service.DigitalHumanConfigService;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DigitalHumanConfigControllerTests {

    private DigitalHumanConfig stored;
    private DigitalHumanConfigController controller;

    @BeforeEach
    void setUp() {
        stored = new DigitalHumanConfig();
        stored.setId(1L);
        DigitalHumanConfigRepository repository = mock(DigitalHumanConfigRepository.class);
        when(repository.findById(1L)).thenReturn(Optional.of(stored));
        when(repository.save(any(DigitalHumanConfig.class))).thenAnswer(invocation -> invocation.getArgument(0));
        controller = new DigitalHumanConfigController(new DigitalHumanConfigService(repository));
    }

    @Test
    void publicMapConfigReportsMissingDatabaseValuesWithoutSecretsFromBuildEnv() {
        MapConfigDto response = controller.getMapConfig();

        assertThat(response.isConfigured()).isFalse();
        assertThat(response.getAmapKey()).isEmpty();
        assertThat(response.getAmapSecurityKey()).isEmpty();
    }

    @Test
    void adminCanStoreAndPublicEndpointCanReadMapConfigFromDatabase() {
        MapConfigDto request = new MapConfigDto();
        request.setAmapKey("  web-key-from-db  ");
        request.setAmapSecurityKey("  security-code-from-db  ");

        MapConfigDto saved = controller.updateMapConfig(request);
        MapConfigDto publicConfig = controller.getMapConfig();

        assertThat(saved.isConfigured()).isTrue();
        assertThat(publicConfig.isConfigured()).isTrue();
        assertThat(publicConfig.getAmapKey()).isEqualTo("web-key-from-db");
        assertThat(publicConfig.getAmapSecurityKey()).isEqualTo("security-code-from-db");
    }
}
