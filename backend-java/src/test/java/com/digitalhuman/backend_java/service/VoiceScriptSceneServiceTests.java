package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.VoiceScriptImportResponse;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository);
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
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository);
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
        VoiceScriptSceneService service = new VoiceScriptSceneService(repository);
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

    private VoiceScriptSceneRepository repository() {
        VoiceScriptSceneRepository repository = mock(VoiceScriptSceneRepository.class);
        when(repository.findBySpotIdAndSceneTypeAndStyleAndVersionNo(anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(Optional.empty());
        when(repository.findAll()).thenReturn(List.of());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        return repository;
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
