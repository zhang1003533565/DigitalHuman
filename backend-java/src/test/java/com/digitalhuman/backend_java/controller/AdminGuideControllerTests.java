package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.FeedbackUpdateRequest;
import com.digitalhuman.backend_java.service.GuideService;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AdminGuideControllerTests {

    @Test
    void patchFeedbackDelegatesValidatedFieldsToService() {
        GuideService service = mock(GuideService.class);
        AdminGuideController controller = new AdminGuideController(service);

        controller.updateFeedback(7L, new FeedbackUpdateRequest("RESOLVED", "ROUTE", "已处理"));

        verify(service).updateFeedback(7L, "RESOLVED", "ROUTE", "已处理");
    }
}
