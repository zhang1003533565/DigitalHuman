package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsAudience;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetric;
import com.digitalhuman.backend_java.dto.TravelAnalyticsMetricResponse;
import com.digitalhuman.backend_java.model.TravelAnalyticsRecord;
import com.digitalhuman.backend_java.repository.TravelAnalyticsRecordRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TravelAnalyticsMetricServiceTests {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void publicAverageSpendReturnsOnlyAggregateDataAndUsesFallbackMethodology() throws Exception {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        when(repository.findAllByOrderByUpdatedAtAscIdAsc()).thenReturn(averageSpendRecords());
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(repository, new TravelAnalyticsValueParser());

        TravelAnalyticsMetricResponse response = service.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND);
        String json = objectMapper.writeValueAsString(response);

        assertEquals(12, response.totalSamples());
        assertEquals(10, response.validSamples());
        assertEquals(LocalDateTime.of(2026, 7, 18, 10, 0), response.asOf());
        assertEquals("total_cost 优先，缺失时回退到五类分项费用累加", response.methodology());
        assertEquals(List.of(new TravelAnalyticsMetricResponse.Item("平均消费（元）", new BigDecimal("156.00"))), response.items());
        assertNull(response.warning());
        assertFalse(json.contains("tourist_id"));
        assertFalse(json.contains("user_nickname"));
    }

    @Test
    void publicDetailedMetricHidesBreakdownWhenValidSamplesAreBelowThreshold() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        when(repository.findAllByOrderByUpdatedAtAscIdAsc()).thenReturn(popularAttractionRecords(9));
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(repository, new TravelAnalyticsValueParser());

        TravelAnalyticsMetricResponse response = service.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.POPULAR_ATTRACTIONS);

        assertEquals(9, response.totalSamples());
        assertEquals(9, response.validSamples());
        assertTrue(response.items().isEmpty());
        assertEquals("样本不足", response.warning());
    }

    @Test
    void adminDetailedMetricBypassesMinimumSampleThreshold() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        when(repository.findAllByOrderByUpdatedAtAscIdAsc()).thenReturn(popularAttractionRecords(9));
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(repository, new TravelAnalyticsValueParser());

        TravelAnalyticsMetricResponse response = service.queryMetric(TravelAnalyticsAudience.ADMIN, TravelAnalyticsMetric.POPULAR_ATTRACTIONS);

        assertEquals(9, response.validSamples());
        assertEquals(4, response.items().size());
        assertNull(response.warning());
    }

    @Test
    void popularAttractionsReturnsTopFiveGroupsOnly() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        when(repository.findAllByOrderByUpdatedAtAscIdAsc()).thenReturn(popularAttractionRecords(12));
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(repository, new TravelAnalyticsValueParser());

        TravelAnalyticsMetricResponse response = service.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.POPULAR_ATTRACTIONS);

        assertEquals(12, response.validSamples());
        assertEquals(List.of(
                new TravelAnalyticsMetricResponse.Item("灵山胜境", new BigDecimal("3")),
                new TravelAnalyticsMetricResponse.Item("拈花湾", new BigDecimal("2")),
                new TravelAnalyticsMetricResponse.Item("鼋头渚", new BigDecimal("2")),
                new TravelAnalyticsMetricResponse.Item("三国城", new BigDecimal("2")),
                new TravelAnalyticsMetricResponse.Item("惠山古镇", new BigDecimal("1"))
        ), response.items());
        assertEquals("按 attraction_name 分组统计有效记录数，仅返回前 5 项", response.methodology());
    }

    @Test
    void averageStayDurationAveragesOnlyParseableDurations() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        when(repository.findAllByOrderByUpdatedAtAscIdAsc()).thenReturn(stayDurationRecords());
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(repository, new TravelAnalyticsValueParser());

        TravelAnalyticsMetricResponse response = service.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_STAY_DURATION);

        assertEquals(12, response.totalSamples());
        assertEquals(10, response.validSamples());
        assertEquals(List.of(new TravelAnalyticsMetricResponse.Item("平均停留时长（分钟）", new BigDecimal("94.00"))), response.items());
        assertEquals("基于可解析停留时长的平均值，单位：分钟", response.methodology());
    }

    @Test
    void averageSatisfactionUsesFivePointScaleOnly() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        when(repository.findAllByOrderByUpdatedAtAscIdAsc()).thenReturn(satisfactionRecords());
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(repository, new TravelAnalyticsValueParser());

        TravelAnalyticsMetricResponse response = service.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SATISFACTION);

        assertEquals(12, response.totalSamples());
        assertEquals(10, response.validSamples());
        assertEquals(List.of(new TravelAnalyticsMetricResponse.Item("平均满意度（5分制）", new BigDecimal("4.20"))), response.items());
        assertEquals("基于可解析满意度的平均值，统一按 5 分制", response.methodology());
    }

    @Test
    void commonVisitorSegmentsReturnsTopFiveAgeAndGenderGroupsOnly() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        when(repository.findAllByOrderByUpdatedAtAscIdAsc()).thenReturn(visitorSegmentRecords());
        TravelAnalyticsMetricService service = new TravelAnalyticsMetricService(repository, new TravelAnalyticsValueParser());

        TravelAnalyticsMetricResponse response = service.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.COMMON_VISITOR_SEGMENTS);

        assertEquals(12, response.totalSamples());
        assertEquals(12, response.validSamples());
        assertEquals(List.of(
                new TravelAnalyticsMetricResponse.Item("26-35岁 / 女", new BigDecimal("3")),
                new TravelAnalyticsMetricResponse.Item("18-25岁 / 男", new BigDecimal("2")),
                new TravelAnalyticsMetricResponse.Item("36-45岁 / 女", new BigDecimal("2")),
                new TravelAnalyticsMetricResponse.Item("46岁及以上 / 男", new BigDecimal("2")),
                new TravelAnalyticsMetricResponse.Item("18岁以下 / 女", new BigDecimal("2"))
        ), response.items());
        assertEquals("按年龄段和性别分组统计有效记录数，仅返回前 5 项", response.methodology());
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

    private List<TravelAnalyticsRecord> stayDurationRecords() {
        return List.of(
                durationRecord("s01", "1小时", LocalDateTime.of(2026, 7, 18, 1, 0)),
                durationRecord("s02", "1小时30分钟", LocalDateTime.of(2026, 7, 18, 2, 0)),
                durationRecord("s03", "2小时", LocalDateTime.of(2026, 7, 18, 3, 0)),
                durationRecord("s04", "2小时30分钟", LocalDateTime.of(2026, 7, 18, 4, 0)),
                durationRecord("s05", "45分钟", LocalDateTime.of(2026, 7, 18, 5, 0)),
                durationRecord("s06", "90分钟", LocalDateTime.of(2026, 7, 18, 6, 0)),
                durationRecord("s07", "1.5小时", LocalDateTime.of(2026, 7, 18, 7, 0)),
                durationRecord("s08", "120分钟", LocalDateTime.of(2026, 7, 18, 8, 0)),
                durationRecord("s09", "75分钟", LocalDateTime.of(2026, 7, 18, 9, 0)),
                durationRecord("s10", "1小时40分钟", LocalDateTime.of(2026, 7, 18, 10, 0)),
                durationRecord("s11", "未知", LocalDateTime.of(2026, 7, 18, 11, 0)),
                durationRecord("s12", "", LocalDateTime.of(2026, 7, 18, 12, 0))
        );
    }

    private List<TravelAnalyticsRecord> satisfactionRecords() {
        return List.of(
                satisfactionRecord("f01", "4.0", LocalDateTime.of(2026, 7, 18, 1, 0)),
                satisfactionRecord("f02", "4.2", LocalDateTime.of(2026, 7, 18, 2, 0)),
                satisfactionRecord("f03", "4.4", LocalDateTime.of(2026, 7, 18, 3, 0)),
                satisfactionRecord("f04", "4.1", LocalDateTime.of(2026, 7, 18, 4, 0)),
                satisfactionRecord("f05", "4.3", LocalDateTime.of(2026, 7, 18, 5, 0)),
                satisfactionRecord("f06", "4.5/5", LocalDateTime.of(2026, 7, 18, 6, 0)),
                satisfactionRecord("f07", "80%", LocalDateTime.of(2026, 7, 18, 7, 0)),
                satisfactionRecord("f08", "4.6", LocalDateTime.of(2026, 7, 18, 8, 0)),
                satisfactionRecord("f09", "3.8", LocalDateTime.of(2026, 7, 18, 9, 0)),
                satisfactionRecord("f10", "4.1", LocalDateTime.of(2026, 7, 18, 10, 0)),
                satisfactionRecord("f11", "6", LocalDateTime.of(2026, 7, 18, 11, 0)),
                satisfactionRecord("f12", "未知", LocalDateTime.of(2026, 7, 18, 12, 0))
        );
    }

    private List<TravelAnalyticsRecord> visitorSegmentRecords() {
        return List.of(
                segmentRecord("g01", "26", "女"),
                segmentRecord("g02", "27", "女"),
                segmentRecord("g03", "35", "女"),
                segmentRecord("g04", "18", "男"),
                segmentRecord("g05", "25", "男"),
                segmentRecord("g06", "36", "女"),
                segmentRecord("g07", "44", "女"),
                segmentRecord("g08", "46", "男"),
                segmentRecord("g09", "52", "男"),
                segmentRecord("g10", "16", "女"),
                segmentRecord("g11", "17", "女"),
                segmentRecord("g12", "19", "女")
        );
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

    private TravelAnalyticsRecord durationRecord(String touristId, String duration, LocalDateTime updatedAt) {
        TravelAnalyticsRecord record = baseRecord(touristId, touristId, updatedAt);
        record.setStay_duration(duration);
        return record;
    }

    private TravelAnalyticsRecord satisfactionRecord(String touristId, String satisfaction, LocalDateTime updatedAt) {
        TravelAnalyticsRecord record = baseRecord(touristId, touristId, updatedAt);
        record.setSatisfaction(satisfaction);
        return record;
    }

    private TravelAnalyticsRecord segmentRecord(String touristId, String age, String gender) {
        TravelAnalyticsRecord record = baseRecord(touristId, touristId, LocalDateTime.of(2026, 7, 18, 9, 0));
        record.setAge(age);
        record.setGender(gender);
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
