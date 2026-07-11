package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.GuideChatResponse;
import com.digitalhuman.backend_java.dto.GuideChatRequest;
import com.digitalhuman.backend_java.repository.AdminModelConfigRepository;
import com.digitalhuman.backend_java.repository.AdminProviderConfigRepository;
import com.digitalhuman.backend_java.repository.GuideMessageRepository;
import com.digitalhuman.backend_java.repository.GuideSessionRepository;
import com.digitalhuman.backend_java.repository.UserFeedbackRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

class GuideServiceTests {

    private GuideService service;
    private GuideSessionRepository sessionRepository;
    private ScenicRouteService scenicRouteService;
    private AdminModelConfigRepository modelConfigRepository;

    @BeforeEach
    void setUp() {
        sessionRepository = mock(GuideSessionRepository.class);
        scenicRouteService = mock(ScenicRouteService.class);
        modelConfigRepository = mock(AdminModelConfigRepository.class);
        service = spy(new GuideService(
                sessionRepository,
                mock(GuideMessageRepository.class),
                mock(UserFeedbackRepository.class),
                scenicRouteService,
                modelConfigRepository,
                mock(AdminProviderConfigRepository.class),
                mock(MaxKbService.class)));
    }

    @Test
    void chatResponseIncludesThreeNonBlankSuggestions() {
        when(sessionRepository.findById("session-1")).thenReturn(Optional.empty());
        when(scenicRouteService.recommendRoutes(null)).thenReturn(List.of());
        when(modelConfigRepository.findFirstByCategoryAndSelectedTrue(org.mockito.ArgumentMatchers.any()))
                .thenReturn(Optional.empty());
        doReturn(List.of()).when(service).retrieveGuideSources("灵山大佛怎么玩？", null);
        doReturn("建议上午先去灵山大佛。").when(service)
                .buildAnswer("session-1", "灵山大佛怎么玩？", null, List.of());
        GuideChatRequest request = new GuideChatRequest();
        request.setSessionId("session-1");
        request.setQuestion("灵山大佛怎么玩？");

        GuideChatResponse response = service.chat(request);

        assertEquals(3, response.getSuggestions().size());
        assertTrue(response.getSuggestions().stream().allMatch(suggestion -> !suggestion.isBlank()));
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
