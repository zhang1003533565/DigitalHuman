package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.AdminModelTestRequestDto;
import com.digitalhuman.backend_java.dto.AdminModelTestResponseDto;
import com.digitalhuman.backend_java.dto.AdminProviderConfigDto;
import com.digitalhuman.backend_java.model.AdminModelConfig;
import com.digitalhuman.backend_java.model.AdminProviderConfig;
import com.digitalhuman.backend_java.model.ModelCategory;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.digitalhuman.backend_java.repository.AdminProviderConfigRepository;
import com.digitalhuman.backend_java.service.AdminSettingsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminSettingsControllerTests {

    private AdminModelConfigRepository modelRepository;
    private AdminProviderConfigRepository providerRepository;
    private AdminSettingsController controller;

    @BeforeEach
    void setUp() {
        modelRepository = mock(AdminModelConfigRepository.class);
        providerRepository = mock(AdminProviderConfigRepository.class);
        AdminSettingsService service = new AdminSettingsService(modelRepository, providerRepository, new ObjectMapper());
        ReflectionTestUtils.setField(service, "aiServiceUrl", "http://127.0.0.1:1");
        controller = new AdminSettingsController(service);
    }

    @Test
    void providerResponsesMaskStoredApiKeys() {
        AdminProviderConfig stored = provider("DeepSeek", "https://api.example.com", "sk-secret-value");
        when(providerRepository.findAllByOrderByProviderAsc()).thenReturn(List.of(stored));

        List<AdminProviderConfigDto> response = controller.getProviderConfigs();

        assertThat(response).singleElement().extracting(AdminProviderConfigDto::getApiKey)
                .isEqualTo("********");
    }

    @Test
    void maskedOrEmptyApiKeyDoesNotOverwriteStoredSecret() {
        AdminProviderConfig stored = provider("DeepSeek", "https://old.example.com", "sk-existing-secret");
        when(providerRepository.findByProviderIgnoreCase("DeepSeek")).thenReturn(Optional.of(stored));
        when(providerRepository.save(any(AdminProviderConfig.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminProviderConfigDto masked = request("DeepSeek", "https://new.example.com", "********");
        AdminProviderConfigDto maskedResponse = controller.saveProviderConfig(masked);
        assertThat(stored.getApiKey()).isEqualTo("sk-existing-secret");
        assertThat(maskedResponse.getApiKey()).isEqualTo("********");

        AdminProviderConfigDto empty = request("DeepSeek", "https://newer.example.com", "   ");
        AdminProviderConfigDto emptyResponse = controller.saveProviderConfig(empty);
        assertThat(stored.getApiKey()).isEqualTo("sk-existing-secret");
        assertThat(emptyResponse.getApiKey()).isEqualTo("********");
        verify(providerRepository, times(2)).save(stored);
    }

    @Test
    void realModelTestFailureDoesNotLeakProviderApiKey() {
        String secret = "sk-do-not-leak";
        AdminModelConfig model = new AdminModelConfig();
        model.setCategory(ModelCategory.CHAT);
        model.setProvider("DeepSeek");
        model.setModelId("deepseek-chat");
        when(modelRepository.findByCategoryAndModelIdIgnoreCase(ModelCategory.CHAT, "deepseek-chat"))
                .thenReturn(Optional.of(model));
        when(providerRepository.findByProviderIgnoreCase("DeepSeek"))
                .thenReturn(Optional.of(provider("DeepSeek", "https://api.example.com", secret)));

        AdminModelTestRequestDto request = new AdminModelTestRequestDto();
        request.setCategory("chat");
        request.setModelId("deepseek-chat");
        request.setText("hello");

        AdminModelTestResponseDto response = controller.testModel(request);

        assertThat(response.isSuccess()).isFalse();
        assertThat(response.getMessage()).isEqualTo("模型测试失败");
        assertThat(response.getDetail()).doesNotContain(secret);
    }

    @Test
    void upstreamTwoHundredFailureDoesNotForwardArbitraryDetail() throws Exception {
        assertUpstreamFailureIsSafe(200, "{\"success\":false,\"provider\":\"DeepSeek\",\"category\":\"chat\",\"modelId\":\"deepseek-chat\",\"message\":\"failed\",\"detail\":\"foreign-secret-token\"}");
    }

    @Test
    void upstreamFourHundredDoesNotForwardArbitraryDetail() throws Exception {
        assertUpstreamFailureIsSafe(400, "{\"message\":\"invalid foreign-secret-token credential\"}");
    }

    private void assertUpstreamFailureIsSafe(int status, String body) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/admin/model-test", exchange -> {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        try {
            AdminSettingsService service = new AdminSettingsService(modelRepository, providerRepository, new ObjectMapper());
            ReflectionTestUtils.setField(service, "aiServiceUrl", "http://127.0.0.1:" + server.getAddress().getPort());
            controller = new AdminSettingsController(service);
            AdminModelConfig model = new AdminModelConfig();
            model.setCategory(ModelCategory.CHAT);
            model.setProvider("DeepSeek");
            model.setModelId("deepseek-chat");
            when(modelRepository.findByCategoryAndModelIdIgnoreCase(ModelCategory.CHAT, "deepseek-chat"))
                    .thenReturn(Optional.of(model));
            when(providerRepository.findByProviderIgnoreCase("DeepSeek"))
                    .thenReturn(Optional.of(provider("DeepSeek", "https://api.example.com", "configured-key")));
            AdminModelTestRequestDto request = new AdminModelTestRequestDto();
            request.setCategory("chat");
            request.setModelId("deepseek-chat");
            request.setText("hello");

            AdminModelTestResponseDto response = controller.testModel(request);

            assertThat(response.isSuccess()).isFalse();
            assertThat(response.getProvider()).isEqualTo("DeepSeek");
            assertThat(response.getModelId()).isEqualTo("deepseek-chat");
            assertThat(response.getDetail()).doesNotContain("foreign-secret-token", "configured-key");
        } finally {
            server.stop(0);
        }
    }

    private static AdminProviderConfig provider(String provider, String baseUrl, String apiKey) {
        AdminProviderConfig config = new AdminProviderConfig();
        config.setProvider(provider);
        config.setBaseUrl(baseUrl);
        config.setApiKey(apiKey);
        config.setProtocol("openai_compatible");
        return config;
    }

    private static AdminProviderConfigDto request(String provider, String baseUrl, String apiKey) {
        AdminProviderConfigDto dto = new AdminProviderConfigDto();
        dto.setProvider(provider);
        dto.setBaseUrl(baseUrl);
        dto.setApiKey(apiKey);
        dto.setProtocol("openai_compatible");
        return dto;
    }
}
