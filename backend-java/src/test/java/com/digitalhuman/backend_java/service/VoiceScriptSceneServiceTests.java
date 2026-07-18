package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.VoiceScriptImportResponse;
import com.digitalhuman.backend_java.dto.VoiceScriptSceneRequest;
import com.digitalhuman.backend_java.dto.VoiceScriptSynthesizeRequest;
import com.digitalhuman.backend_java.dto.TtsRequest;
import com.digitalhuman.backend_java.model.VoiceScriptScene;
import com.digitalhuman.backend_java.repository.VoiceScriptSceneRepository;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.springframework.web.server.ResponseStatusException;

class VoiceScriptSceneServiceTests {

    private static final List<String> STRUCTURED_HEADERS = List.of(
            "景区名称",
            "景点ID",
            "景点名称",
            "具体位置",
            "建筑/景观参数",
            "核心功能",
            "文化内涵",
            "详细介绍",
            "游玩亮点",
            "演艺/开放信息",
            "备注"
    );

    @Test
    void importFromDocxGeneratesDraftsFromEveryStructuredSpotTable() throws Exception {
        VoiceScriptSceneRepository repository = repository();
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository, mock(TtsService.class));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "structured.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                structuredDocx()
        );

        VoiceScriptImportResponse result = service.importFromDocx(file, "灵山胜境", "culture", 1);

        assertEquals(3, result.getImportedCount());
        assertEquals(0, result.getSkippedCount());
        ArgumentCaptor<VoiceScriptScene> captor = ArgumentCaptor.forClass(VoiceScriptScene.class);
        verify(repository, times(3)).save(captor.capture());
        assertEquals(List.of("LS-001", "LS-002", "NH-001"), captor.getAllValues().stream().map(VoiceScriptScene::getSpotId).toList());
        assertTrue(captor.getAllValues().stream().allMatch(row -> "spot".equals(row.getSceneType())));
        assertTrue(captor.getAllValues().stream().allMatch(row -> "draft".equals(row.getStatus())));
    }

    @Test
    void importFromDocxCanClearExistingRowsAfterRecognizingAValidDocument() throws Exception {
        VoiceScriptSceneRepository repository = repository();
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository, mock(TtsService.class));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "structured.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                structuredDocx()
        );

        service.importFromDocx(file, "灵山胜境", "culture", 1, true);

        verify(repository).deleteAllInBatch();
    }


    @Test
    void paragraphFallbackDoesNotTreatGuideSubsectionsAsSpots() throws Exception {
        VoiceScriptSceneRepository repository = repository();
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository, mock(TtsService.class));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "guide.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                guideDocxWithSubsections()
        );

        VoiceScriptImportResponse result = service.importFromDocx(file, "灵山胜境", "culture", 1);

        assertEquals(1, result.getImportedCount());
        ArgumentCaptor<VoiceScriptScene> captor = ArgumentCaptor.forClass(VoiceScriptScene.class);
        verify(repository).save(captor.capture());
        assertEquals("overview", captor.getValue().getSpotId());
    }

    @Test
    void guideDocxImportsSpotContentFromTablesWithoutMinimumLengthSkip() throws Exception {
        VoiceScriptSceneRepository repository = repository();
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository, mock(TtsService.class));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "guide.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                guideDocxWithSpotTable()
        );

        VoiceScriptImportResponse result = service.importFromDocx(file, "灵山胜境", "culture", 1);

        assertEquals(2, result.getImportedCount());
        assertEquals(0, result.getSkippedCount());
        ArgumentCaptor<VoiceScriptScene> captor = ArgumentCaptor.forClass(VoiceScriptScene.class);
        verify(repository, times(2)).save(captor.capture());
        List<VoiceScriptScene> savedRows = captor.getAllValues();
        assertEquals(List.of("overview", "灵山大佛-世界最高露天青铜释迦牟尼立像"), savedRows.stream().map(VoiceScriptScene::getSpotId).toList());
        assertTrue(savedRows.get(1).getScriptText().contains("基本数据"));
        assertTrue(savedRows.get(1).getScriptText().contains("最佳体验"));
    }

    @Test
    void publishRejectsScriptWithoutCurrentReadyAudio() {
        VoiceScriptSceneRepository repository = repository();
        VoiceScriptScene draft = scene(10L, 1, "draft", "missing", null, "原始口播内容");
        when(repository.findById(10L)).thenReturn(Optional.of(draft));
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository, mock(TtsService.class));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.publish(10L));

        assertEquals(400, exception.getStatusCode().value());
        assertTrue(exception.getReason().contains("合成"));
    }

    @Test
    void manualCreateAlwaysUsesNextDraftVersion() {
        VoiceScriptSceneRepository repository = repository();
        when(repository.findTopBySpotIdAndSceneTypeAndStyleOrderByVersionNoDesc("LS-001", "spot", "culture"))
                .thenReturn(Optional.of(scene(8L, 3, "published", "ready", "hash", "旧版本")));
        when(repository.save(any(VoiceScriptScene.class))).thenAnswer(invocation -> invocation.getArgument(0));
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository, mock(TtsService.class));

        VoiceScriptScene created = service.create(request("简短手工口播"));

        assertEquals(4, created.getVersionNo());
        assertEquals("draft", created.getStatus());
        assertEquals("manual", created.getGenerationMode());
    }

    @Test
    void updateMarksExistingAudioStaleWhenScriptTextChanges() {
        VoiceScriptSceneRepository repository = repository();
        VoiceScriptScene existing = scene(11L, 1, "draft", "ready", "old-hash", "旧口播内容");
        when(repository.findById(11L)).thenReturn(Optional.of(existing));
        when(repository.findBySpotIdAndSceneTypeAndStyleAndVersionNoAndIdNot(anyString(), anyString(), anyString(), anyInt(), any()))
                .thenReturn(Optional.empty());
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository, mock(TtsService.class));

        service.update(11L, request("新口播内容"));

        assertEquals("stale", existing.getAudioStatus());
    }

    @Test
    void updateRejectsPublishedVersionToPreserveHistory() {
        VoiceScriptSceneRepository repository = repository();
        VoiceScriptScene published = scene(21L, 2, "published", "ready", "hash", "线上口播");
        when(repository.findById(21L)).thenReturn(Optional.of(published));
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository, mock(TtsService.class));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.update(21L, request("试图原地修改"))
        );

        assertEquals(409, exception.getStatusCode().value());
        assertTrue(exception.getReason().contains("回滚"));
    }

    @Test
    void rollbackCopiesHistoricalContentIntoNextDraftVersionWithoutAudio() {
        VoiceScriptSceneRepository repository = repository();
        VoiceScriptScene historical = scene(12L, 2, "archived", "ready", "hash", "值得恢复的历史口播");
        when(repository.findById(12L)).thenReturn(Optional.of(historical));
        when(repository.findTopBySpotIdAndSceneTypeAndStyleOrderByVersionNoDesc("LS-001", "spot", "culture"))
                .thenReturn(Optional.of(scene(13L, 4, "draft", "missing", null, "较新版本")));
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository, mock(TtsService.class));

        VoiceScriptScene rolledBack = service.rollback(12L);

        assertEquals(5, rolledBack.getVersionNo());
        assertEquals("draft", rolledBack.getStatus());
        assertEquals("值得恢复的历史口播", rolledBack.getScriptText());
        assertEquals("missing", rolledBack.getAudioStatus());
        assertEquals("manual", rolledBack.getGenerationMode());
        verify(repository).save(rolledBack);
    }

    @Test
    void synthesizeStoresAudioAssetAndCurrentScriptHash() throws Exception {
        VoiceScriptSceneRepository repository = repository();
        TtsService ttsService = mock(TtsService.class);
        VoiceScriptScene draft = scene(14L, 1, "draft", "missing", null, "用于合成的口播内容");
        when(repository.findById(14L)).thenReturn(Optional.of(draft));
        when(ttsService.synthesize(any(TtsRequest.class))).thenReturn("tts/voice-14.mp3");
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository, ttsService);
        VoiceScriptSynthesizeRequest request = new VoiceScriptSynthesizeRequest();
        request.setVoiceId("zh-CN-XiaoxiaoNeural");
        request.setSpeechRate("+5%");
        request.setSpeechVolume("+0%");
        request.setSpeechPitch("+0Hz");

        VoiceScriptScene synthesized = service.synthesize(14L, request);

        assertEquals("ready", synthesized.getAudioStatus());
        assertEquals("/api/tts/audio/voice-14.mp3", synthesized.getAudioUrl());
        assertEquals("voice-14.mp3", synthesized.getAudioFileName());
        assertEquals(VoiceScriptSceneService.scriptHash(draft.getScriptText()), synthesized.getAudioScriptHash());
        assertTrue(synthesized.getAudioGeneratedAt() != null);
    }

    @Test
    void listPublishedOnlyReturnsReadyAudioMatchingCurrentText() {
        VoiceScriptSceneRepository repository = repository();
        VoiceScriptScene valid = scene(20L, 3, "published", "ready", VoiceScriptSceneService.scriptHash("有效口播"), "有效口播");
        VoiceScriptScene staleHash = scene(21L, 2, "published", "ready", "wrong", "已变化口播");
        when(repository.findBySpotIdAndStatusIgnoreCaseOrderByVersionNoDesc("LS-001", "published"))
                .thenReturn(List.of(valid, staleHash));
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository, mock(TtsService.class));

        List<VoiceScriptScene> published = service.listPublished("LS-001");

        assertEquals(List.of(valid), published);
    }

    @Test
    void legacyRowsReceiveDomainDefaultsAfterLoading() {
        VoiceScriptScene legacy = new VoiceScriptScene();
        legacy.setDurationSec(75);

        legacy.postLoad();

        assertEquals("manual", legacy.getGenerationMode());
        assertEquals("missing", legacy.getAudioStatus());
        assertEquals(75, legacy.getTargetDurationSec());
    }

    @Test
    void synthesizePersistsFailedStatusWhenTtsThrows() throws Exception {
        VoiceScriptSceneRepository repository = repository();
        TtsService ttsService = mock(TtsService.class);
        VoiceScriptScene draft = scene(15L, 1, "draft", "missing", null, "合成失败仍需保留的口播");
        when(repository.findById(15L)).thenReturn(Optional.of(draft));
        when(ttsService.synthesize(any(TtsRequest.class))).thenThrow(new IllegalStateException("service unavailable"));
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository, ttsService);
        VoiceScriptSynthesizeRequest request = new VoiceScriptSynthesizeRequest();
        request.setVoiceId("zh-CN-XiaoxiaoNeural");

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.synthesize(15L, request));

        assertEquals(502, exception.getStatusCode().value());
        assertEquals("failed", draft.getAudioStatus());
        verify(repository).save(draft);
    }

    private VoiceScriptSceneRepository repository() {
        VoiceScriptSceneRepository repository = mock(VoiceScriptSceneRepository.class);
        when(repository.findBySpotIdAndSceneTypeAndStyleAndVersionNo(anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(Optional.empty());
        when(repository.findAll()).thenReturn(List.of());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        return repository;
    }

    private VoiceScriptScene scene(Long id, int version, String status, String audioStatus, String audioHash, String scriptText) {
        VoiceScriptScene scene = new VoiceScriptScene();
        scene.setId(id);
        scene.setScenicName("灵山胜境");
        scene.setSpotId("LS-001");
        scene.setSpotName("灵山大佛");
        scene.setSceneType("spot");
        scene.setStyle("culture");
        scene.setTitle("灵山大佛讲解");
        scene.setScriptText(scriptText);
        scene.setSsmlText("");
        scene.setDurationSec(60);
        scene.setTargetDurationSec(60);
        scene.setVersionNo(version);
        scene.setStatus(status);
        scene.setGenerationMode("manual");
        scene.setAudioStatus(audioStatus);
        scene.setAudioScriptHash(audioHash);
        if ("ready".equals(audioStatus)) {
            scene.setAudioUrl("tts/voice-" + id + ".mp3");
            scene.setAudioFileName("voice-" + id + ".mp3");
        }
        return scene;
    }

    private VoiceScriptSceneRequest request(String scriptText) {
        VoiceScriptSceneRequest request = new VoiceScriptSceneRequest();
        request.setScenicName("灵山胜境");
        request.setSpotId("LS-001");
        request.setSpotName("灵山大佛");
        request.setSceneType("spot");
        request.setStyle("culture");
        request.setTitle("灵山大佛讲解");
        request.setScriptText(scriptText);
        request.setDurationSec(60);
        request.setVersionNo(1);
        request.setStatus("draft");
        return request;
    }

    private byte[] structuredDocx() throws Exception {
        try (XWPFDocument document = new XWPFDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            appendStructuredTable(document, List.of(
                    row("灵山胜境", "LS-001", "灵山大照壁"),
                    row("灵山胜境", "LS-002", "五明桥")
            ));
            appendStructuredTable(document, List.of(
                    row("拈花湾禅意小镇", "NH-001", "拈花广场")
            ));
            document.write(output);
            return output.toByteArray();
        }
    }

    private byte[] guideDocxWithSubsections() throws Exception {
        try (XWPFDocument document = new XWPFDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            paragraph(document, "灵山胜境是以佛教文化、太湖山水和江南园林体验为核心的综合景区。这里将大佛瞻礼、梵宫艺术、九龙灌浴、五印坛城等内容串联成完整的文化游览动线，适合游客先建立整体印象，再依据体力和兴趣选择深入参观。");
            paragraph(document, "实用游览贴士：全方位保障你的灵山之旅");
            paragraph(document, "住宿：景区周边有度假酒店、民宿和亲子型客栈，适合不同预算的游客选择。游客可以根据第二天是否继续游览拈花湾来安排入住区域。");
            paragraph(document, "餐饮：餐饮区域提供素食、简餐和地方小吃，建议高峰期错峰用餐，并提前关注团队游客集中的时间段。");
            document.write(output);
            return output.toByteArray();
        }
    }

    private byte[] guideDocxWithSpotTable() throws Exception {
        try (XWPFDocument document = new XWPFDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            paragraph(document, "灵山胜境：历史、文化、景点特色与个性化游览指南");
            paragraph(document, "景区概况与千年历史渊源");
            paragraph(document, "灵山胜境坐落于江苏省无锡市太湖西北部，是国家5A级旅游景区，也是以佛教文化、太湖山水和现代旅游服务结合为特色的综合性景区。");
            paragraph(document, "核心景点特色详解：佛教艺术的殿堂");
            paragraph(document, "灵山大佛：世界最高露天青铜释迦牟尼立像");
            XWPFTable table = document.createTable(1, 2);
            table.getRow(0).getCell(0).setText("项目");
            table.getRow(0).getCell(1).setText("详细信息");
            var data = table.createRow();
            data.getCell(0).setText("基本数据");
            data.getCell(1).setText("通高88米，是游客进入灵山胜境后最具识别度的核心景观。");
            var experience = table.createRow();
            experience.getCell(0).setText("最佳体验");
            experience.getCell(1).setText("登顶抱佛脚，俯瞰太湖全景。");
            document.write(output);
            return output.toByteArray();
        }
    }

    private void appendStructuredTable(XWPFDocument document, List<List<String>> rows) {
        XWPFTable table = document.createTable(1, STRUCTURED_HEADERS.size());
        for (int index = 0; index < STRUCTURED_HEADERS.size(); index++) {
            table.getRow(0).getCell(index).setText(STRUCTURED_HEADERS.get(index));
        }
        for (List<String> row : rows) {
            var tableRow = table.createRow();
            for (int index = 0; index < row.size(); index++) {
                tableRow.getCell(index).setText(row.get(index));
            }
        }
    }

    private List<String> row(String scenicName, String spotId, String spotName) {
        return List.of(
                scenicName,
                spotId,
                spotName,
                "景区核心区域",
                spotName + "拥有清晰的空间界面、标志性景观和适合停留观赏的游线节点。",
                "承担游客集散、文化认知、拍照停留和讲解承接功能。",
                "体现灵山胜境将佛教文化、江南山水和现代旅游服务结合的表达方式。",
                spotName + "是游览动线中的重要节点，游客可以在这里理解景区的文化主题、空间秩序和参观节奏，并顺势进入下一段游览。",
                "适合拍照、听讲解、观察建筑细节，也适合作为团队集合点。",
                "以现场公告为准。",
                "建议结合游客体力和当天客流灵活安排。"
        );
    }

    private void paragraph(XWPFDocument document, String text) {
        document.createParagraph().createRun().setText(text);
    }
}
