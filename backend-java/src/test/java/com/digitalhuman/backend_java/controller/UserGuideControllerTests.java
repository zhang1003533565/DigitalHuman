package com.digitalhuman.backend_java.controller;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.digitalhuman.backend_java.dto.FeedbackRecordDto;
import com.digitalhuman.backend_java.service.GuideService;
import java.util.List;
import org.junit.jupiter.api.Test;

class UserGuideControllerTests {
    @Test
    void feedbackHistoryDelegatesWithSessionScope() {
        GuideService service = mock(GuideService.class);
        List<FeedbackRecordDto> expected = List.of();
        when(service.getFeedbackRecordsForSession("session-7")).thenReturn(expected);

        var result = new UserGuideController(service).getFeedback("session-7");

        assertSame(expected, result);
        verify(service).getFeedbackRecordsForSession("session-7");
    }
}
