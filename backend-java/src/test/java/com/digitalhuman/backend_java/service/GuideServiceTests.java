package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.GuideChatResponse;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.digitalhuman.backend_java.repository.AdminProviderConfigRepository;
import com.digitalhuman.backend_java.repository.GuideMessageRepository;
import com.digitalhuman.backend_java.repository.GuideSessionRepository;
import com.digitalhuman.backend_java.repository.UserFeedbackRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class GuideServiceTests {

    private GuideService service;

    @BeforeEach
    void setUp() {
        service = new GuideService(
                mock(GuideSessionRepository.class),
                mock(GuideMessageRepository.class),
                mock(UserFeedbackRepository.class),
                mock(ScenicRouteService.class),
                mock(AdminModelConfigRepository.class),
                mock(AdminProviderConfigRepository.class),
                mock(MaxKbService.class));
    }

    @Test
    void buildsThreeNonBlankFollowUpSuggestionsForGuideAnswer() {
        List<String> relatedSpots = List.of("灵山大佛", "九龙灌浴");
        List<String> recommendedRoutes = List.of("历史文化爱好者路线");
        GuideChatResponse response = new GuideChatResponse(
                "session-1", "trace-1", "灵山大佛适合上午游览。", relatedSpots, recommendedRoutes,
                service.buildSuggestions("灵山大佛适合上午游览。", relatedSpots, recommendedRoutes), List.of());

        assertEquals(3, response.getSuggestions().size());
        assertTrue(response.getSuggestions().stream().allMatch(suggestion -> suggestion != null && !suggestion.isBlank()));
    }
}
