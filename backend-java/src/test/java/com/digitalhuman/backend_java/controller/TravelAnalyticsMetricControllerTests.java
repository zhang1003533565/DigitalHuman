package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.config.AuthInterceptor;
import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.TravelAnalyticsAiConfig;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.service.AuthTokenService;
import com.digitalhuman.backend_java.service.TravelAnalyticsAiConfigService;
import com.digitalhuman.backend_java.service.TravelAnalyticsMetricService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.format.support.FormattingConversionService;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.web.server.ResponseStatusException;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TravelAnalyticsMetricControllerTests {

    private final TravelAnalyticsMetricService metricService = mock(TravelAnalyticsMetricService.class);
    private final TravelAnalyticsAiConfigService aiConfigService = mock(TravelAnalyticsAiConfigService.class);
    private final AuthTokenService tokens = mock(AuthTokenService.class);

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        FormattingConversionService conversionService = new FormattingConversionService();
        conversionService.addConverter(String.class, TravelAnalyticsMetric.class, TravelAnalyticsMetric::fromValue);

        mvc = MockMvcBuilders.standaloneSetup(
                        new UserTravelAnalyticsController(metricService),
                        new AdminTravelAnalyticsController(null, metricService, aiConfigService))
                .setConversionService(conversionService)
                .setMessageConverters(new MappingJackson2HttpMessageConverter())
                .addInterceptors(new AuthInterceptor(tokens))
                .build();
    }

    @Test
    void userMetricPathBindsSnakeCaseMetric() throws Exception {
        loginUser();
        when(metricService.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND))
                .thenReturn(metricResponse(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND));

        mvc.perform(get("/api/user/travel-analytics/metrics/average_spend")
                        .header("Authorization", "Bearer user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metric").value("average_spend"))
                .andExpect(jsonPath("$.scope").value("PUBLIC"))
                .andExpect(jsonPath("$.validSamples").value(10))
                .andExpect(jsonPath("$.items[0].label").value("平均消费（元）"))
                .andExpect(jsonPath("$.items[0].value").value(156.00))
                .andExpect(jsonPath("$.tourist_id").doesNotExist());

        verify(metricService).queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND);
    }

    @Test
    void unknownMetricReturnsBadRequestWithoutCallingService() throws Exception {
        loginUser();

        mvc.perform(get("/api/user/travel-analytics/metrics/not_a_metric")
                        .header("Authorization", "Bearer user"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(metricService);
    }

    @Test
    void userMetricReturnsNotFoundWhenPublicAccessDisabled() throws Exception {
        loginUser();
        when(metricService.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND))
                .thenThrow(new ResponseStatusException(NOT_FOUND, "统计接口未开放"));

        mvc.perform(get("/api/user/travel-analytics/metrics/average_spend")
                        .header("Authorization", "Bearer user"))
                .andExpect(status().isNotFound());

        verify(metricService).queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND);
    }

    @Test
    void adminCanReadAndUpdateAiConfig() throws Exception {
        loginAdmin();
        when(aiConfigService.getConfig()).thenReturn(enabledConfig());
        when(aiConfigService.updateConfig(false, 25)).thenReturn(updatedConfig());

        mvc.perform(get("/api/admin/travel-analytics/ai-config")
                        .header("Authorization", "Bearer admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("default"))
                .andExpect(jsonPath("$.publicEnabled").value(true))
                .andExpect(jsonPath("$.minimumSampleSize").value(10));

        mvc.perform(put("/api/admin/travel-analytics/ai-config")
                        .header("Authorization", "Bearer admin")
                        .contentType("application/json")
                        .content("""
                                {"publicEnabled":false,"minimumSampleSize":25}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publicEnabled").value(false))
                .andExpect(jsonPath("$.minimumSampleSize").value(25));

        verify(aiConfigService).updateConfig(false, 25);
    }

    @Test
    void observerCannotUpdateAiConfig() throws Exception {
        loginObserver();

        mvc.perform(put("/api/admin/travel-analytics/ai-config")
                        .header("Authorization", "Bearer observer")
                        .contentType("application/json")
                        .content("""
                                {"publicEnabled":false,"minimumSampleSize":25}
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(aiConfigService, metricService);
    }

    @Test
    void adminTestEndpointUsesAdminAudience() throws Exception {
        loginAdmin();
        when(metricService.queryMetric(TravelAnalyticsAudience.ADMIN, TravelAnalyticsMetric.AVERAGE_SPEND))
                .thenReturn(metricResponse(TravelAnalyticsAudience.ADMIN, TravelAnalyticsMetric.AVERAGE_SPEND));

        mvc.perform(post("/api/admin/travel-analytics/metrics/average_spend/test")
                        .header("Authorization", "Bearer admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scope").value("ADMIN"))
                .andExpect(jsonPath("$.metric").value("average_spend"));

        verify(metricService).queryMetric(TravelAnalyticsAudience.ADMIN, TravelAnalyticsMetric.AVERAGE_SPEND);
    }

    private void loginUser() {
        when(tokens.getSession("user")).thenReturn(Optional.of(new AuthSession(1L, "u", "u", UserRole.USER)));
    }

    private void loginAdmin() {
        when(tokens.getSession("admin")).thenReturn(Optional.of(new AuthSession(2L, "a", "a", UserRole.ADMIN)));
    }

    private void loginObserver() {
        when(tokens.getSession("observer")).thenReturn(Optional.of(new AuthSession(3L, "o", "o", UserRole.OBSERVER)));
    }

    private TravelAnalyticsMetricResponse metricResponse(TravelAnalyticsAudience audience, TravelAnalyticsMetric metric) {
        return new TravelAnalyticsMetricResponse(
                metric,
                audience,
                12,
                10,
                LocalDateTime.of(2026, 7, 18, 12, 0),
                List.of(new TravelAnalyticsMetricResponse.Item("平均消费（元）", new BigDecimal("156.00"))),
                "total_cost 优先，缺失时回退到五类分项费用累加",
                null
        );
    }

    private TravelAnalyticsAiConfig enabledConfig() {
        TravelAnalyticsAiConfig config = new TravelAnalyticsAiConfig();
        config.setId("default");
        config.setPublicEnabled(true);
        config.setMinimumSampleSize(10);
        config.setUpdatedAt(LocalDateTime.of(2026, 7, 18, 9, 0));
        return config;
    }

    private TravelAnalyticsAiConfig disabledConfig() {
        TravelAnalyticsAiConfig config = enabledConfig();
        config.setPublicEnabled(false);
        return config;
    }

    private TravelAnalyticsAiConfig updatedConfig() {
        TravelAnalyticsAiConfig config = disabledConfig();
        config.setMinimumSampleSize(25);
        config.setUpdatedAt(LocalDateTime.of(2026, 7, 18, 9, 30));
        return config;
    }
}
