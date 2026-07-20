package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.model.TravelAnalyticsAiConfig;
import com.digitalhuman.backend_java.model.TravelAnalyticsRecord;
import com.digitalhuman.backend_java.repository.TravelAnalyticsRecordRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.ZoneOffset;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TravelAnalyticsMetricServiceTests {

    @Test
    void publicMetricRejectsWhenPublicAccessDisabledBeforeQueryingRecords() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        TravelAnalyticsAiConfigService configService = mock(TravelAnalyticsAiConfigService.class);
        TravelAnalyticsAiConfig config = new TravelAnalyticsAiConfig();
        config.setId("default");
        config.setPublicEnabled(false);
        config.setMinimumSampleSize(10);
        when(configService.getConfig()).thenReturn(config);
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(
                repository,
                new TravelAnalyticsValueParser(),
                configService);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND));

        assertEquals(404, exception.getStatusCode().value());
        verifyNoInteractions(repository);
    }

    @Test
    void queryMetricReusesCachedResponseForSameAudienceAndMetric() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        when(repository.findAllByOrderByUpdatedAtAscIdAsc()).thenReturn(averageSpendRecords());
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(
                repository,
                new TravelAnalyticsValueParser(),
                enabledPublicConfigService(),
                new TravelAnalyticsMetricCache());

        TravelAnalyticsMetricResponse first = service.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND);
        TravelAnalyticsMetricResponse second = service.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND);

        assertSame(first, second);
        verify(repository, times(1)).findAllByOrderByUpdatedAtAscIdAsc();
    }

    @Test
    void adminDetailedMetricDoesNotReadPublicConfigForThreshold() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        when(repository.findAllByOrderByUpdatedAtAscIdAsc()).thenReturn(popularAttractionRecords(9));
        TravelAnalyticsAiConfigService configService = publicConfigService(25);
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(
                repository,
                new TravelAnalyticsValueParser(),
                configService);

        TravelAnalyticsMetricResponse response = service.queryMetric(TravelAnalyticsAudience.ADMIN, TravelAnalyticsMetric.POPULAR_ATTRACTIONS);

        assertEquals(9, response.validSamples());
        verifyNoInteractions(configService);
    }

    @Test
    void publicDetailedMetricReadsConfiguredMinimumSampleSize() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        when(repository.findAllByOrderByUpdatedAtAscIdAsc()).thenReturn(popularAttractionRecords(12));
        TravelAnalyticsAiConfigService configService = publicConfigService(25);
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(
                repository,
                new TravelAnalyticsValueParser(),
                configService,
                new TravelAnalyticsMetricCache());

        TravelAnalyticsMetricResponse response = service.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.POPULAR_ATTRACTIONS);

        assertEquals(12, response.validSamples());
        verify(configService, times(2)).getConfig();
    }

    private TravelAnalyticsAiConfigService publicConfigService(int minimumSampleSize) {
        TravelAnalyticsAiConfigService configService = mock(TravelAnalyticsAiConfigService.class);
        TravelAnalyticsAiConfig config = new TravelAnalyticsAiConfig();
        config.setId("default");
        config.setPublicEnabled(true);
        config.setMinimumSampleSize(minimumSampleSize);
        config.setUpdatedAt(LocalDateTime.of(2026, 7, 18, 9, 0));
        when(configService.getConfig()).thenReturn(config);
        return configService;
    }

    private TravelAnalyticsAiConfigService enabledPublicConfigService() {
        return publicConfigService(10);
    }

    private List<TravelAnalyticsRecord> averageSpendRecords() {
        return List.of(
                spendRecord("u01", "游客01", "100", null, null, null, null, null, LocalDateTime.of(2026, 7, 18, 1, 0)),
                spendRecord("u02", "游客02", "110", null, null, null, null, null, LocalDateTime.of(2026, 7, 18, 2, 0)),
                spendRecord("u03", "游客03", "120", null, null, null, null, null, LocalDateTime.of(2026, 7, 18, 3, 0)),
                spendRecord("u04", "游客04", "130", null, null, null, null, null, LocalDateTime.of(2026, 7, 18, 4, 0)),
                spendRecord("u05", "游客05", "140", null, null, null, null, null, LocalDateTime.of(2026, 7, 18, 5, 0)),
                spendRecord("u06", "游客06", "150", null, null, null, null, null, LocalDateTime.of(2026, 7, 18, 6, 0)),
                spendRecord("u07", "游客07", "", "10", "20", "30", "20", "80", LocalDateTime.of(2026, 7, 18, 7, 0)),
                spendRecord("u08", "游客08", "", "20", "20", "20", "20", "100", LocalDateTime.of(2026, 7, 18, 8, 0)),
                spendRecord("u09", "游客09", "", "40", "20", "20", "20", "120", LocalDateTime.of(2026, 7, 18, 9, 0)),
                spendRecord("u10", "游客10", "", "50", "20", "20", "20", "140", LocalDateTime.of(2026, 7, 18, 10, 0)),
                spendRecord("u11", "游客11", "未知", "未知", "未知", "未知", "未知", "未知", LocalDateTime.of(2026, 7, 18, 11, 0)),
                spendRecord("u12", "游客12", "", "未知", "", "", "", "未知", LocalDateTime.of(2026, 7, 18, 12, 0))
        );
    }

    private List<TravelAnalyticsRecord> popularAttractionRecords(int validCount) {
        List<String> attractions = List.of(
                "灵山胜境", "灵山胜境", "灵山胜境",
                "拈花湾", "拈花湾",
                "鼋头渚", "鼋头渚",
                "三国城", "三国城",
                "惠山古镇",
                "蠡园",
                "梅园"
        );
        List<TravelAnalyticsRecord> records = new java.util.ArrayList<>();
        for (int index = 0; index < validCount; index++) {
            String name = attractions.get(index);
            TravelAnalyticsRecord record = baseRecord("segment-" + index, "游客" + index, LocalDateTime.of(2026, 7, 18, 9, 0));
            record.setAttraction_name(name);
            records.add(record);
        }
        return records;
    }

    private TravelAnalyticsRecord spendRecord(
            String touristId,
            String nickname,
            String totalCost,
            String ticketCost,
            String foodCost,
            String shoppingCost,
            String transportCost,
            String entertainmentCost,
            LocalDateTime updatedAt) {
        TravelAnalyticsRecord record = baseRecord(touristId, nickname, updatedAt);
        record.setTotal_cost(totalCost);
        record.setTicket_cost(ticketCost);
        record.setFood_cost(foodCost);
        record.setShopping_cost(shoppingCost);
        record.setTransport_cost(transportCost);
        record.setEntertainment_cost(entertainmentCost);
        return record;
    }

    private TravelAnalyticsRecord baseRecord(String touristId, String nickname, LocalDateTime updatedAt) {
        TravelAnalyticsRecord record = new TravelAnalyticsRecord();
        record.setTourist_id(touristId);
        record.setUser_nickname(nickname);
        record.setUpdatedAt(updatedAt);
        record.setCreatedAt(updatedAt.minusDays(1));
        return record;
    }
}
