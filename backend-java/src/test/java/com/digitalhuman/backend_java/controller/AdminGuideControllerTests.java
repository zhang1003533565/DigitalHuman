package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.FeedbackUpdateRequest;
import com.digitalhuman.backend_java.service.GuideService;
import org.junit.jupiter.api.Test;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminGuideControllerTests {

    @Test
    void patchFeedbackDelegatesValidatedFieldsToService() {
        GuideService service = mock(GuideService.class);
        AdminGuideController controller = new AdminGuideController(service);

        controller.updateFeedback(7L, new FeedbackUpdateRequest("RESOLVED", "ROUTE", "已处理"));

        verify(service).updateFeedback(7L, "RESOLVED", "ROUTE", "已处理");
    }

    @Test
    void patchFeedbackRejectsAdminNoteLongerThanOneThousandCharacters() throws Exception {
        GuideService service = mock(GuideService.class);
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminGuideController(service))
                .setValidator(validator)
                .build();
        String note = "x".repeat(1001);

        mvc.perform(patch("/api/admin/guide/feedback/7")
                        .contentType("application/json")
                        .content("{\"status\":\"RESOLVED\",\"category\":\"ROUTE\",\"adminNote\":\"" + note + "\"}"))
                .andExpect(status().isBadRequest());
    }
}
