package com.digitalhuman.backend_java.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TravelAnalyticsValueParserTests {

    private final TravelAnalyticsValueParser parser = new TravelAnalyticsValueParser();

    @Test
    void parsesChineseUnitsAndRejectsUnknownValues() {
        assertEquals(new BigDecimal("128.50"), parser.parseMoney("¥128.50元").orElseThrow());
        assertEquals(Duration.ofMinutes(90), parser.parseDuration("1小时30分钟").orElseThrow());
        assertEquals(new BigDecimal("4.5"), parser.parseSatisfaction("4.5/5").orElseThrow());
        assertTrue(parser.parseMoney("未知").isEmpty());
    }
}
