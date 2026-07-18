package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicStructuredImportResult;
import com.digitalhuman.backend_java.model.ScenicStructuredSpotRecord;
import com.digitalhuman.backend_java.repository.ScenicStructuredSpotRecordRepository;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ScenicStructuredSpotServiceTests {

    private static final List<String> HEADERS = List.of(
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
    void importFromDocxImportsEveryMatchingTable() throws Exception {
        ScenicStructuredSpotRecordRepository repository = mock(ScenicStructuredSpotRecordRepository.class);
        when(repository.saveAll(org.mockito.ArgumentMatchers.anyList())).thenAnswer(invocation -> invocation.getArgument(0));
        ScenicStructuredSpotService service = new ScenicStructuredSpotService(repository);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "scenic.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                docxWithTwoStructuredTables()
        );

        ScenicStructuredImportResult result = service.importFromDocx(file, true);

        assertEquals(3, result.getImportedCount());
        assertEquals(0, result.getSkippedEmptyCount());
        assertEquals(0, result.getSkippedDuplicateCount());
        assertEquals(0, result.getIssues().size());
        verify(repository).deleteAllInBatch();
        ArgumentCaptor<List<ScenicStructuredSpotRecord>> rows = ArgumentCaptor.forClass(List.class);
        verify(repository).saveAll(rows.capture());
        assertEquals(List.of("LS-001", "LS-002", "NH-001"), rows.getValue().stream().map(ScenicStructuredSpotRecord::getSpot_id).toList());
    }

    private byte[] docxWithTwoStructuredTables() throws Exception {
        try (XWPFDocument document = new XWPFDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            document.createParagraph().createRun().setText("灵山胜境 景点结构化数据集");
            appendTable(document, List.of(
                    row("灵山胜境", "LS-001", "灵山大照壁"),
                    row("灵山胜境", "LS-002", "五明桥")
            ));
            document.createParagraph().createRun().setText("表2：拈花湾禅意小镇 景点数据集");
            appendTable(document, List.of(
                    row("拈花湾禅意小镇", "NH-001", "拈花广场")
            ));
            document.write(output);
            return output.toByteArray();
        }
    }

    private void appendTable(XWPFDocument document, List<List<String>> rows) {
        XWPFTable table = document.createTable(1, HEADERS.size());
        for (int index = 0; index < HEADERS.size(); index++) {
            table.getRow(0).getCell(index).setText(HEADERS.get(index));
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
                "具体位置",
                "建筑/景观参数",
                "核心功能",
                "文化内涵",
                "详细介绍",
                "游玩亮点",
                "演艺/开放信息",
                "备注"
        );
    }
}
