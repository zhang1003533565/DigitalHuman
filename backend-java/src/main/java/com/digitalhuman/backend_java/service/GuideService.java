package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.FeedbackRecordDto;
import com.digitalhuman.backend_java.dto.FeedbackRequest;
import com.digitalhuman.backend_java.dto.GuideChatRequest;
import com.digitalhuman.backend_java.dto.GuideChatResponse;
import com.digitalhuman.backend_java.dto.GuideMessageDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto;
import com.digitalhuman.backend_java.dto.ScenicSpotDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GuideService {

    private final List<ScenicSpotDto> spots = List.of(
            new ScenicSpotDto("spot-1", "灵山胜境", "灵山大佛", "景区核心地标，适合了解整体文化背景。", "08:00-17:00", List.of("历史文化", "地标", "热门")),
            new ScenicSpotDto("spot-2", "灵山胜境", "九龙灌浴", "经典演艺打卡点，适合演示讲解与互动。", "09:00-16:30", List.of("演艺", "亲子", "热门")),
            new ScenicSpotDto("spot-3", "拈花湾", "拈花塔", "夜游氛围强，适合轻松路线与拍照。", "10:00-21:00", List.of("自然风光", "夜游", "拍照"))
    );

    private final List<ScenicRouteDto> routes = List.of(
            new ScenicRouteDto("route-1", "历史文化爱好者路线", "历史文化", "6小时", "适合首次深度了解灵山文化脉络的游客。", List.of("灵山大佛", "九龙灌浴")),
            new ScenicRouteDto("route-2", "自然风光爱好者路线", "自然风光", "5小时", "适合偏爱景观和放松游览节奏的游客。", List.of("拈花塔", "灵山大佛")),
            new ScenicRouteDto("route-3", "亲子家庭路线", "亲子家庭", "4小时", "适合家庭出游，节奏更轻松，互动点更集中。", List.of("九龙灌浴", "拈花塔"))
    );

    private final Map<String, List<GuideMessageDto>> sessions = new ConcurrentHashMap<>();
    private final List<FeedbackRecordDto> feedbackRecords = new ArrayList<>();

    public List<ScenicSpotDto> getAllSpots() {
        return spots;
    }

    public List<ScenicRouteDto> recommendRoutes(String interest) {
        if (interest == null || interest.isBlank()) {
            return routes;
        }

        return routes.stream()
                .filter(route -> route.getSuitableFor().contains(interest))
                .toList();
    }

    public GuideChatResponse chat(GuideChatRequest request) {
        String sessionId = request.getSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = "session-" + UUID.randomUUID();
        }

        String answerText = buildAnswer(request.getQuestion(), request.getInterest());
        List<String> relatedSpots = spots.stream().map(ScenicSpotDto::getName).limit(2).toList();
        List<String> recommendedRoutes = recommendRoutes(request.getInterest()).stream()
                .map(ScenicRouteDto::getName)
                .toList();

        List<GuideMessageDto> messages = sessions.computeIfAbsent(sessionId, key -> new ArrayList<>());
        long now = System.currentTimeMillis();
        messages.add(new GuideMessageDto("user", request.getQuestion(), now));
        messages.add(new GuideMessageDto("assistant", answerText, now + 1));

        return new GuideChatResponse(sessionId, answerText, relatedSpots, recommendedRoutes);
    }

    public List<GuideMessageDto> getSessionMessages(String sessionId) {
        return sessions.getOrDefault(sessionId, List.of());
    }

    public void saveFeedback(FeedbackRequest request) {
        feedbackRecords.add(new FeedbackRecordDto(
                request.getSessionId(),
                request.getQuestion(),
                request.getAnswer(),
                request.isHelpful(),
                request.getRating(),
                request.getComment(),
                System.currentTimeMillis()
        ));
    }

    public List<FeedbackRecordDto> getFeedbackRecords() {
        return feedbackRecords.stream()
                .sorted(Comparator.comparingLong(FeedbackRecordDto::getTimestamp).reversed())
                .toList();
    }

    private String buildAnswer(String question, String interest) {
        String suffix = interest == null || interest.isBlank()
                ? "如果你愿意，我还可以继续推荐对应路线。"
                : "结合你的兴趣，我也会优先推荐对应主题路线。";
        return "你提到的是“" + question + "”。当前演示版本会优先基于灵山胜境官方资料返回景点介绍、路线建议和游玩提示，" + suffix;
    }
}
