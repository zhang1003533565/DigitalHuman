package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.VoiceScriptGenerateRequest;
import com.digitalhuman.backend_java.model.ScenicStructuredSpotRecord;
import com.digitalhuman.backend_java.model.VoiceScriptScene;
import com.digitalhuman.backend_java.repository.ScenicStructuredSpotRecordRepository;
import com.digitalhuman.backend_java.repository.VoiceScriptSceneRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class VoiceScriptGenerationServiceTests {

    @Test
    void generateRetrievesEachKnowledgeFiltersDocumentsPromptsDurationAndSavesNextVersion() throws Exception {
        MaxKbKnowledgeService maxKb = mock(MaxKbKnowledgeService.class);
        ScenicStructuredSpotRecordRepository scenicRepository = mock(ScenicStructuredSpotRecordRepository.class);
        VoiceScriptSceneRepository voiceRepository = mock(VoiceScriptSceneRepository.class);
        when(scenicRepository.findBySpot_idIgnoreCase("LS-001")).thenReturn(Optional.of(spot()));
        when(voiceRepository.findTopBySpotIdAndSceneTypeAndStyleOrderByVersionNoDesc("LS-001", "spot", "culture"))
                .thenReturn(Optional.of(version(4)));
        when(voiceRepository.save(any(VoiceScriptScene.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(maxKb.hitTest(anyLong(), any())).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = invocation.getArgument(1);
            String knowledgeId = payload.get("knowledge_id").toString();
            if ("knowledge-a".equals(knowledgeId)) {
                return Map.of("data", List.of(
                        hit("doc-a", "灵山文化指南", "大佛通高八十八米。"),
                        hit("doc-excluded", "未选择文档", "这段不得进入提示词。")
                ));
            }
            return Map.of("data", List.of(hit("doc-b", "游览服务", "建议游客放慢语速聆听。")));
        });
        List<Map<String, Object>> aiPayloads = new ArrayList<>();
        VoiceScriptGenerationService service = new VoiceScriptGenerationService(
                maxKb,
                scenicRepository,
                voiceRepository,
                new ObjectMapper(),
                payload -> {
                    aiPayloads.add(new LinkedHashMap<>(payload));
                    return "灵山大佛巍然矗立于景区核心区域，这段口播由所选知识资料整理而成。";
                }
        );

        VoiceScriptScene generated = service.generate(request());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> hitPayload = ArgumentCaptor.forClass(Map.class);
        verify(maxKb, org.mockito.Mockito.times(2)).hitTest(org.mockito.Mockito.eq(7L), hitPayload.capture());
        assertEquals(List.of("knowledge-a", "knowledge-b"), hitPayload.getAllValues().stream()
                .map(item -> item.get("knowledge_id").toString()).toList());
        assertEquals(1, aiPayloads.size());
        String systemPrompt = aiPayloads.get(0).get("systemPrompt").toString();
        String message = aiPayloads.get(0).get("message").toString();
        assertTrue(systemPrompt.contains("90秒"));
        assertTrue(message.contains("大佛通高八十八米"));
        assertTrue(message.contains("建议游客放慢语速"));
        assertTrue(message.contains("景区核心区域"));
        assertFalse(message.contains("这段不得进入提示词"));
        assertEquals(5, generated.getVersionNo());
        assertEquals("draft", generated.getStatus());
        assertEquals("ai", generated.getGenerationMode());
        assertEquals("missing", generated.getAudioStatus());
        assertEquals(90, generated.getTargetDurationSec());
        assertTrue(generated.getSourceRefsJson().contains("knowledge-a"));
        assertTrue(generated.getSourceRefsJson().contains("doc-a"));
        assertFalse(generated.getSourceRefsJson().contains("doc-excluded"));
        verify(voiceRepository).save(generated);
    }

    @Test
    void generateRejectsWhenSpotAndKnowledgeProvideNoEffectiveSource() {
        MaxKbKnowledgeService maxKb = mock(MaxKbKnowledgeService.class);
        ScenicStructuredSpotRecordRepository scenicRepository = mock(ScenicStructuredSpotRecordRepository.class);
        VoiceScriptSceneRepository voiceRepository = mock(VoiceScriptSceneRepository.class);
        when(scenicRepository.findBySpot_idIgnoreCase("LS-001")).thenReturn(Optional.empty());
        when(maxKb.hitTest(anyLong(), any())).thenReturn(Map.of("data", List.of()));
        VoiceScriptGenerationService service = new VoiceScriptGenerationService(
                maxKb, scenicRepository, voiceRepository, new ObjectMapper(), payload -> "不应调用"
        );

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.generate(request()));

        assertEquals(400, exception.getStatusCode().value());
        verify(voiceRepository, never()).save(any());
    }

    @Test
    void generateDoesNotSaveWhenBasicChatReturnsBlank() {
        MaxKbKnowledgeService maxKb = mock(MaxKbKnowledgeService.class);
        ScenicStructuredSpotRecordRepository scenicRepository = mock(ScenicStructuredSpotRecordRepository.class);
        VoiceScriptSceneRepository voiceRepository = mock(VoiceScriptSceneRepository.class);
        when(scenicRepository.findBySpot_idIgnoreCase("LS-001")).thenReturn(Optional.of(spot()));
        when(maxKb.hitTest(anyLong(), any())).thenReturn(Map.of("data", List.of()));
        VoiceScriptGenerationService service = new VoiceScriptGenerationService(
                maxKb, scenicRepository, voiceRepository, new ObjectMapper(), payload -> "  "
        );

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.generate(request()));

        assertEquals(502, exception.getStatusCode().value());
        verify(voiceRepository, never()).save(any());
    }

    private VoiceScriptGenerateRequest request() {
        VoiceScriptGenerateRequest request = new VoiceScriptGenerateRequest();
        request.setAccountId(7L);
        request.setSpotId("LS-001");
        request.setStyle("culture");
        request.setTargetDurationSec(90);
        request.setAdditionalRequirements("突出文化内涵，避免书面腔");
        request.setKnowledgeSources(List.of(
                source("knowledge-a", "灵山历史库", List.of("doc-a")),
                source("knowledge-b", "游客服务库", List.of("doc-b"))
        ));
        return request;
    }

    private VoiceScriptGenerateRequest.KnowledgeSource source(
            String knowledgeId,
            String knowledgeName,
            List<String> documentIds) {
        VoiceScriptGenerateRequest.KnowledgeSource source = new VoiceScriptGenerateRequest.KnowledgeSource();
        source.setKnowledgeId(knowledgeId);
        source.setKnowledgeName(knowledgeName);
        source.setDocumentIds(documentIds);
        return source;
    }

    private Map<String, Object> hit(String documentId, String documentName, String content) {
        return Map.of(
                "id", "paragraph-" + documentId,
                "document_id", documentId,
                "document_name", documentName,
                "content", content,
                "similarity", 0.9
        );
    }

    private ScenicStructuredSpotRecord spot() {
        ScenicStructuredSpotRecord spot = new ScenicStructuredSpotRecord();
        spot.setScenic_name("灵山胜境");
        spot.setSpot_id("LS-001");
        spot.setSpot_name("灵山大佛");
        spot.setLocation("景区核心区域");
        spot.setArchitecture_landscape_params("通高八十八米");
        spot.setCultural_connotation("体现佛教文化与当代铸造艺术");
        spot.setDetailed_introduction("灵山大佛是景区核心文化地标");
        spot.setHighlights("可登云道并远眺太湖");
        return spot;
    }

    private VoiceScriptScene version(int versionNo) {
        VoiceScriptScene scene = new VoiceScriptScene();
        scene.setVersionNo(versionNo);
        return scene;
    }
}
