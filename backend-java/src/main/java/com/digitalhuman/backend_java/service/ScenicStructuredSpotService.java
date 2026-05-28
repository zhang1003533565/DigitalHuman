package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicStructuredImportIssueDto;
import com.digitalhuman.backend_java.dto.ScenicStructuredImportResult;
import com.digitalhuman.backend_java.dto.ScenicStructuredSpotRecordRequest;
import com.digitalhuman.backend_java.model.ScenicStructuredSpotRecord;
import com.digitalhuman.backend_java.repository.ScenicStructuredSpotRecordRepository;
import jakarta.transaction.Transactional;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class ScenicStructuredSpotService {

    private static final List<String> REQUIRED_HEADERS_ZH = List.of(
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

    private final ScenicStructuredSpotRecordRepository repository;

    public ScenicStructuredSpotService(ScenicStructuredSpotRecordRepository repository) {
        this.repository = repository;
    }

    public List<ScenicStructuredSpotRecord> listAll() {
        return repository.findAllByOrderByIdAsc();
    }

    public ScenicStructuredSpotRecord getById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "记录不存在"));
    }

    @Transactional
    public ScenicStructuredSpotRecord createRecord(ScenicStructuredSpotRecordRequest request) {
        String spotId = normalize(request.getSpot_id());
        if (spotId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "景点ID不能为空");
        }
        if (repository.findBySpot_idIgnoreCase(spotId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "景点ID已存在");
        }

        ScenicStructuredSpotRecord entity = new ScenicStructuredSpotRecord();
        applyRequest(entity, request);
        return repository.save(entity);
    }

    @Transactional
    public ScenicStructuredSpotRecord updateRecord(Long id, ScenicStructuredSpotRecordRequest request) {
        ScenicStructuredSpotRecord entity = getById(id);
        String spotId = normalize(request.getSpot_id());
        if (spotId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "景点ID不能为空");
        }
        if (repository.findBySpot_idIgnoreCaseAndIdNot(spotId, id).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "景点ID已存在");
        }

        applyRequest(entity, request);
        return repository.save(entity);
    }

    @Transactional
    public void deleteRecord(Long id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "记录不存在");
        }
        repository.deleteById(id);
    }

    public byte[] buildTemplateFile() {
        try (XWPFDocument document = new XWPFDocument(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            XWPFTable table = document.createTable(1, REQUIRED_HEADERS_ZH.size());
            XWPFTableRow headerRow = table.getRow(0);
            for (int index = 0; index < REQUIRED_HEADERS_ZH.size(); index++) {
                headerRow.getCell(index).setText(REQUIRED_HEADERS_ZH.get(index));
            }
            document.write(outputStream);
            return outputStream.toByteArray();
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "生成模板失败");
        }
    }

    @Transactional
    public ScenicStructuredImportResult importFromDocx(MultipartFile file, boolean replaceAll) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "上传文件不能为空");
        }

        String originalFilename = normalize(file.getOriginalFilename()).toLowerCase();
        if (!originalFilename.endsWith(".docx")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅支持 .docx 文件");
        }

        try (InputStream inputStream = file.getInputStream(); XWPFDocument document = new XWPFDocument(inputStream)) {
            XWPFTable targetTable = findTableByHeaders(document);
            if (targetTable == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "未找到匹配表头的表格，表头必须严格为：" + String.join("、", REQUIRED_HEADERS_ZH)
                );
            }

            if (replaceAll) {
                repository.deleteAllInBatch();
            }

            List<ScenicStructuredSpotRecord> rows = new ArrayList<>();
            List<ScenicStructuredImportIssueDto> issues = new ArrayList<>();
            Set<String> spotIdSeen = new HashSet<>();
            int skippedEmptyCount = 0;
            int skippedDuplicateCount = 0;

            List<XWPFTableRow> tableRows = targetTable.getRows();
            for (int rowIndex = 1; rowIndex < tableRows.size(); rowIndex++) {
                XWPFTableRow row = tableRows.get(rowIndex);
                if (row == null) {
                    skippedEmptyCount++;
                    continue;
                }

                ParseRowResult parsed = fromRow(row, rowIndex + 1);
                if (parsed.emptyRow()) {
                    skippedEmptyCount++;
                    continue;
                }
                if (parsed.issue() != null) {
                    issues.add(parsed.issue());
                    continue;
                }

                ScenicStructuredSpotRecord entity = parsed.entity();
                if (entity == null) {
                    continue;
                }

                String spotId = normalize(entity.getSpot_id());
                if (spotIdSeen.contains(spotId)) {
                    skippedDuplicateCount++;
                    issues.add(new ScenicStructuredImportIssueDto(rowIndex + 1, "景点ID重复，已跳过"));
                    continue;
                }
                spotIdSeen.add(spotId);
                rows.add(entity);
            }

            if (!rows.isEmpty()) {
                repository.saveAll(rows);
            }

            return new ScenicStructuredImportResult(rows.size(), skippedEmptyCount, skippedDuplicateCount, issues);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "读取 DOCX 失败：" + exception.getMessage());
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "解析 DOCX 失败：" + exception.getMessage());
        }
    }

    private XWPFTable findTableByHeaders(XWPFDocument document) {
        for (XWPFTable table : document.getTables()) {
            List<XWPFTableRow> rows = table.getRows();
            if (rows == null || rows.isEmpty()) {
                continue;
            }
            XWPFTableRow headerRow = rows.get(0);
            if (headerRow == null) {
                continue;
            }
            List<String> headers = new ArrayList<>();
            for (int index = 0; index < REQUIRED_HEADERS_ZH.size(); index++) {
                headers.add(normalize(getCellText(headerRow, index)));
            }
            if (REQUIRED_HEADERS_ZH.equals(headers)) {
                return table;
            }
        }
        return null;
    }

    private ParseRowResult fromRow(XWPFTableRow row, int rowNumber) {
        String scenicName = normalize(getCellText(row, 0));
        String spotId = normalize(getCellText(row, 1));
        String spotName = normalize(getCellText(row, 2));
        String location = normalize(getCellText(row, 3));
        String architectureLandscapeParams = normalize(getCellText(row, 4));
        String coreFunction = normalize(getCellText(row, 5));
        String culturalConnotation = normalize(getCellText(row, 6));
        String detailedIntroduction = normalize(getCellText(row, 7));
        String highlights = normalize(getCellText(row, 8));
        String performanceOpenInfo = normalize(getCellText(row, 9));
        String remark = normalize(getCellText(row, 10));

        if (isEntireRowEmpty(List.of(
                scenicName,
                spotId,
                spotName,
                location,
                architectureLandscapeParams,
                coreFunction,
                culturalConnotation,
                detailedIntroduction,
                highlights,
                performanceOpenInfo,
                remark))) {
            return ParseRowResult.empty();
        }

        if (spotId.isBlank()) {
            return ParseRowResult.issue(new ScenicStructuredImportIssueDto(rowNumber, "景点ID不能为空"));
        }

        ScenicStructuredSpotRecord entity = new ScenicStructuredSpotRecord();
        entity.setScenic_name(scenicName);
        entity.setSpot_id(spotId);
        entity.setSpot_name(spotName);
        entity.setLocation(location);
        entity.setArchitecture_landscape_params(architectureLandscapeParams);
        entity.setCore_function(coreFunction);
        entity.setCultural_connotation(culturalConnotation);
        entity.setDetailed_introduction(detailedIntroduction);
        entity.setHighlights(highlights);
        entity.setPerformance_open_info(performanceOpenInfo);
        entity.setRemark(remark);
        return ParseRowResult.entity(entity);
    }

    private void applyRequest(ScenicStructuredSpotRecord entity, ScenicStructuredSpotRecordRequest request) {
        entity.setScenic_name(normalize(request.getScenic_name()));
        entity.setSpot_id(normalize(request.getSpot_id()));
        entity.setSpot_name(normalize(request.getSpot_name()));
        entity.setLocation(normalize(request.getLocation()));
        entity.setArchitecture_landscape_params(normalize(request.getArchitecture_landscape_params()));
        entity.setCore_function(normalize(request.getCore_function()));
        entity.setCultural_connotation(normalize(request.getCultural_connotation()));
        entity.setDetailed_introduction(normalize(request.getDetailed_introduction()));
        entity.setHighlights(normalize(request.getHighlights()));
        entity.setPerformance_open_info(normalize(request.getPerformance_open_info()));
        entity.setRemark(normalize(request.getRemark()));
    }

    private String getCellText(XWPFTableRow row, int cellIndex) {
        List<XWPFTableCell> cells = row.getTableCells();
        if (cells == null || cellIndex >= cells.size()) {
            return "";
        }
        XWPFTableCell cell = cells.get(cellIndex);
        return cell == null ? "" : normalize(cell.getText());
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isEntireRowEmpty(List<String> values) {
        for (String value : values) {
            if (!normalize(value).isBlank()) {
                return false;
            }
        }
        return true;
    }

    private record ParseRowResult(
            ScenicStructuredSpotRecord entity,
            ScenicStructuredImportIssueDto issue,
            boolean emptyRow
    ) {
        private static ParseRowResult entity(ScenicStructuredSpotRecord entity) {
            return new ParseRowResult(entity, null, false);
        }

        private static ParseRowResult issue(ScenicStructuredImportIssueDto issue) {
            return new ParseRowResult(null, issue, false);
        }

        private static ParseRowResult empty() {
            return new ParseRowResult(null, null, true);
        }
    }
}
