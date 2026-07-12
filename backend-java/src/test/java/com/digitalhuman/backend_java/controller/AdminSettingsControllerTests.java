package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.AdminModelTestRequestDto;
import com.digitalhuman.backend_java.dto.AdminModelTestResponseDto;
import com.digitalhuman.backend_java.dto.AdminProviderConfigDto;
import com.digitalhuman.backend_java.dto.AgentHealthTestRequestDto;
import com.digitalhuman.backend_java.dto.AgentModelBindingItemDto;
import com.digitalhuman.backend_java.dto.AgentModelBindingPayloadDto;
import com.digitalhuman.backend_java.model.AdminModelConfig;
import com.digitalhuman.backend_java.model.AdminProviderConfig;
import com.digitalhuman.backend_java.model.ModelCategory;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.digitalhuman.backend_java.repository.AdminProviderConfigRepository;
import com.digitalhuman.backend_java.service.AdminSettingsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import okhttp3.Call;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;

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
        AdminProviderConfig stored = provider("DeepSeek", "https://api.example.com", "provider-secret-value");
        when(providerRepository.findAllByOrderByProviderAsc()).thenReturn(List.of(stored));

        List<AdminProviderConfigDto> response = controller.getProviderConfigs();

        assertThat(response).singleElement().extracting(AdminProviderConfigDto::getApiKey)
                .isEqualTo("********");
    }

    @Test
    void maskedOrEmptyApiKeyDoesNotOverwriteStoredSecret() {
        AdminProviderConfig stored = provider("DeepSeek", "https://old.example.com", "provider-existing-secret");
        when(providerRepository.findByProviderIgnoreCase("DeepSeek")).thenReturn(Optional.of(stored));
        when(providerRepository.save(any(AdminProviderConfig.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminProviderConfigDto masked = request("DeepSeek", "https://new.example.com", "********");
        AdminProviderConfigDto maskedResponse = controller.saveProviderConfig(masked);
        assertThat(stored.getApiKey()).isEqualTo("provider-existing-secret");
        assertThat(maskedResponse.getApiKey()).isEqualTo("********");

        AdminProviderConfigDto empty = request("DeepSeek", "https://newer.example.com", "   ");
        AdminProviderConfigDto emptyResponse = controller.saveProviderConfig(empty);
        assertThat(stored.getApiKey()).isEqualTo("provider-existing-secret");
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

    @Test
    void agentManagementCallsSendServiceToken() throws Exception {
        OkHttpClient httpClient = mock(OkHttpClient.class);
        List<Request> requests = new java.util.ArrayList<>();
        when(httpClient.newCall(any(Request.class))).thenAnswer(invocation -> {
            Request request = invocation.getArgument(0);
            requests.add(request);
            Call call = mock(Call.class);
            String body = request.url().encodedPath().endsWith("runtime-test")
                    ? "{\"agent\":\"basic_chat\",\"success\":true}"
                    : "{\"items\":[]}";
            when(call.execute()).thenReturn(upstreamResponse(request, 200, body));
            return call;
        });

        AdminSettingsService service = new AdminSettingsService(modelRepository, providerRepository, new ObjectMapper());
        ReflectionTestUtils.setField(service, "aiServiceUrl", "http://ai-service.test");
        ReflectionTestUtils.setField(service, "aiServiceAdminToken", "admin-service-token");
        ReflectionTestUtils.setField(service, "httpClient", httpClient);

        service.getAgentModelBindings();
        AgentModelBindingItemDto item = new AgentModelBindingItemDto();
        item.setAgent("basic_chat");
        item.setCategory("chat");
        item.setProvider("DeepSeek");
        item.setModel("deepseek-chat");
        item.setTimeoutSeconds(30);
        AgentModelBindingPayloadDto bindings = new AgentModelBindingPayloadDto();
        bindings.setItems(List.of(item));
        when(modelRepository.findByCategoryAndProviderIgnoreCaseAndModelIdIgnoreCase(
                ModelCategory.CHAT, "DeepSeek", "deepseek-chat")).thenReturn(Optional.of(new AdminModelConfig()));
        service.updateAgentModelBindings(bindings);
        AgentHealthTestRequestDto runtime = new AgentHealthTestRequestDto();
        runtime.setAgent("basic_chat");
        runtime.setTask("hello");
        service.testAgent(runtime);

        assertThat(requests).hasSize(3).allSatisfy(request ->
                assertThat(request.header("X-Service-Token")).isEqualTo("admin-service-token"));
    }

    private void assertUpstreamFailureIsSafe(int status, String body) throws Exception {
        OkHttpClient httpClient = mock(OkHttpClient.class);
        Call call = mock(Call.class);
        when(httpClient.newCall(any(Request.class))).thenReturn(call);
        when(call.execute()).thenAnswer(invocation -> upstreamResponse(status, body));

        AdminSettingsService service = new AdminSettingsService(modelRepository, providerRepository, new ObjectMapper());
        ReflectionTestUtils.setField(service, "aiServiceUrl", "http://ai-service.test");
        ReflectionTestUtils.setField(service, "aiServiceAdminToken", "admin-service-token");
        ReflectionTestUtils.setField(service, "httpClient", httpClient);
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

        ArgumentCaptor<Request> requestCaptor = ArgumentCaptor.forClass(Request.class);
        verify(httpClient).newCall(requestCaptor.capture());
        assertThat(requestCaptor.getValue().header("X-Service-Token")).isEqualTo("admin-service-token");

        assertThat(response.isSuccess()).isFalse();
        assertThat(response.getProvider()).isEqualTo("DeepSeek");
        assertThat(response.getModelId()).isEqualTo("deepseek-chat");
        assertThat(response.getDetail()).doesNotContain("foreign-secret-token", "configured-key");
    }

    private static Response upstreamResponse(int status, String body) {
        Request request = new Request.Builder().url("http://ai-service.test/admin/model-test").build();
        return upstreamResponse(request, status, body);
    }

    private static Response upstreamResponse(Request request, int status, String body) {
        return new Response.Builder()
                .request(request)
                .protocol(Protocol.HTTP_1_1)
                .code(status)
                .message("test response")
                .body(ResponseBody.create(body, MediaType.get("application/json")))
                .build();
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
