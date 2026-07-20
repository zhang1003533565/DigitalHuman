package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.model.TravelAnalyticsAiConfig;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TravelAnalyticsMetricServiceTests {

    @Test
    void publicMetricRejectsWhenPublicAccessDisabledBeforeReadingSnapshot() {
        TravelAnalyticsSnapshotService snapshotService = mock(TravelAnalyticsSnapshotService.class);
        TravelAnalyticsAiConfigService configService = configService(false);
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(snapshotService, configService);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.queryMetric(
                        TravelAnalyticsAudience.PUBLIC,
                        TravelAnalyticsMetric.AVERAGE_SPEND));

        assertEquals(404, exception.getStatusCode().value());
        assertEquals("统计接口未开放", exception.getReason());
        verifyNoInteractions(snapshotService);
    }

    @Test
    void publicMetricDelegatesToLatestReadySnapshotWithoutCacheOrLiveAggregation() {
        TravelAnalyticsSnapshotService snapshotService = mock(TravelAnalyticsSnapshotService.class);
        TravelAnalyticsMetricResponse published = response(TravelAnalyticsAudience.PUBLIC);
        when(snapshotService.getMetric(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND)).thenReturn(published);
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(
                snapshotService,
                configService(true));

        TravelAnalyticsMetricResponse first = service.queryMetric(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND);
        TravelAnalyticsMetricResponse second = service.queryMetric(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND);

        assertSame(published, first);
        assertSame(published, second);
        verify(snapshotService, org.mockito.Mockito.times(2)).getMetric(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND);
    }

    @Test
    void adminMetricReadsSnapshotWithoutConsultingPublicConfig() {
        TravelAnalyticsSnapshotService snapshotService = mock(TravelAnalyticsSnapshotService.class);
        TravelAnalyticsAiConfigService configService = mock(TravelAnalyticsAiConfigService.class);
        TravelAnalyticsMetricResponse published = response(TravelAnalyticsAudience.ADMIN);
        when(snapshotService.getMetric(
                TravelAnalyticsAudience.ADMIN,
                TravelAnalyticsMetric.POPULAR_ATTRACTIONS)).thenReturn(published);
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(snapshotService, configService);

        TravelAnalyticsMetricResponse actual = service.queryMetric(
                TravelAnalyticsAudience.ADMIN,
                TravelAnalyticsMetric.POPULAR_ATTRACTIONS);

        assertSame(published, actual);
        verifyNoInteractions(configService);
    }

    @Test
    void noReadySnapshotRemainsServiceUnavailableAndIsNotRecomputed() {
        TravelAnalyticsSnapshotService snapshotService = mock(TravelAnalyticsSnapshotService.class);
        when(snapshotService.getMetric(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND)).thenThrow(
                        new ResponseStatusException(
                                org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                                "统计快照尚未生成"));
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(
                snapshotService,
                configService(true));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.queryMetric(
                        TravelAnalyticsAudience.PUBLIC,
                        TravelAnalyticsMetric.AVERAGE_SPEND));

        assertEquals(503, exception.getStatusCode().value());
        assertEquals("统计快照尚未生成", exception.getReason());
        verify(snapshotService).getMetric(
                TravelAnalyticsAudience.PUBLIC,
                TravelAnalyticsMetric.AVERAGE_SPEND);
    }

    private TravelAnalyticsAiConfigService configService(boolean publicEnabled) {
        TravelAnalyticsAiConfigService configService = mock(TravelAnalyticsAiConfigService.class);
        TravelAnalyticsAiConfig config = new TravelAnalyticsAiConfig();
        config.setId("default");
        config.setPublicEnabled(publicEnabled);
        config.setMinimumSampleSize(10);
        when(configService.getConfig()).thenReturn(config);
        return configService;
    }

    private TravelAnalyticsMetricResponse response(TravelAnalyticsAudience audience) {
        return new TravelAnalyticsMetricResponse(
                TravelAnalyticsMetric.AVERAGE_SPEND,
                audience,
                12,
                10,
                LocalDateTime.of(2026, 7, 20, 10, 0),
                List.of(new TravelAnalyticsMetricResponse.Item("平均消费（元）", BigDecimal.TEN)),
                "published snapshot",
                null);
    }
}
