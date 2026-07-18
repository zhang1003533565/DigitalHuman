package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicStructuredImportIssueDto;
import com.digitalhuman.backend_java.dto.ScenicStructuredImportResult;
import com.digitalhuman.backend_java.dto.ScenicStructuredSpotRecordRequest;
import com.digitalhuman.backend_java.model.ScenicStructuredSpotRecord;
import com.digitalhuman.backend_java.model.VoiceScriptScene;
import com.digitalhuman.backend_java.repository.ScenicStructuredSpotRecordRepository;
import com.digitalhuman.backend_java.repository.VoiceScriptSceneRepository;
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
    private final VoiceScriptSceneRepository voiceScriptRepository;

    public ScenicStructuredSpotService(
            ScenicStructuredSpotRecordRepository repository,
            VoiceScriptSceneRepository voiceScriptRepository
    ) {
        this.repository = repository;
        this.voiceScriptRepository = voiceScriptRepository;
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

        validateVisitorExperience(request);
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

        validateVisitorExperience(request);
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
            List<XWPFTable> targetTables = findTablesByHeaders(document);
            if (targetTables.isEmpty()) {
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

            int logicalRowNumber = 1;
            for (XWPFTable targetTable : targetTables) {
                List<XWPFTableRow> tableRows = targetTable.getRows();
                for (int rowIndex = 1; rowIndex < tableRows.size(); rowIndex++) {
                    logicalRowNumber++;
                    XWPFTableRow row = tableRows.get(rowIndex);
                    if (row == null) {
                        skippedEmptyCount++;
                        continue;
                    }

                    ParseRowResult parsed = fromRow(row, logicalRowNumber);
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
                        issues.add(new ScenicStructuredImportIssueDto(logicalRowNumber, "景点ID重复，已跳过"));
                        continue;
                    }
                    spotIdSeen.add(spotId);
                    rows.add(entity);
                }
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

    private List<XWPFTable> findTablesByHeaders(XWPFDocument document) {
        List<XWPFTable> matchedTables = new ArrayList<>();
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
                matchedTables.add(table);
            }
        }
        return matchedTables;
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
        entity.setAudio_enabled(false);
        entity.setLive_enabled(false);
        entity.setDefault_experience(null);
        entity.setBound_voice_script_id(null);
        entity.setLive_source_type(null);
        entity.setLive_video_url(null);
        entity.setLive_stream_url(null);
        entity.setCamera_stream_key(null);
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
        boolean audioEnabled = Boolean.TRUE.equals(request.getAudio_enabled());
        boolean liveEnabled = Boolean.TRUE.equals(request.getLive_enabled());
        entity.setAudio_enabled(audioEnabled);
        entity.setLive_enabled(liveEnabled);
        entity.setDefault_experience(resolveDefaultExperience(request, audioEnabled, liveEnabled));
        entity.setBound_voice_script_id(request.getBound_voice_script_id());
        entity.setLive_source_type(normalizeNullable(request.getLive_source_type()));
        entity.setLive_video_url(normalizeNullable(request.getLive_video_url()));
        entity.setLive_stream_url(normalizeNullable(request.getLive_stream_url()));
        entity.setCamera_stream_key(normalizeNullable(request.getCamera_stream_key()));
    }

    private void validateVisitorExperience(ScenicStructuredSpotRecordRequest request) {
        boolean audioEnabled = Boolean.TRUE.equals(request.getAudio_enabled());
        boolean liveEnabled = Boolean.TRUE.equals(request.getLive_enabled());

        if (audioEnabled) {
            validateBoundVoiceScript(request.getBound_voice_script_id(), request.getSpot_id());
        }
        if (liveEnabled) {
            validateLiveSource(request);
        }
        if (audioEnabled && liveEnabled) {
            String defaultExperience = normalize(request.getDefault_experience()).toLowerCase();
            if (!Set.of("audio", "live").contains(defaultExperience)) {
                throw badRequest("同时启用语音和直播时，默认入口必须为 audio 或 live");
            }
        }
    }

    private void validateBoundVoiceScript(Long voiceScriptId, String spotId) {
        if (voiceScriptId == null) {
            throw badRequest("启用语音时必须绑定口播");
        }
        VoiceScriptScene voiceScript = voiceScriptRepository.findById(voiceScriptId)
                .orElseThrow(() -> badRequest("绑定的口播不存在"));
        if (!normalize(spotId).equalsIgnoreCase(normalize(voiceScript.getSpotId()))) {
            throw badRequest("绑定口播必须属于当前景点");
        }
        if (!"published".equalsIgnoreCase(normalize(voiceScript.getStatus()))) {
            throw badRequest("只能绑定已发布的口播");
        }
        if (!"ready".equalsIgnoreCase(normalize(voiceScript.getAudioStatus()))) {
            throw badRequest("只能绑定音频已就绪的口播");
        }
    }

    private void validateLiveSource(ScenicStructuredSpotRecordRequest request) {
        String sourceType = normalize(request.getLive_source_type()).toLowerCase();
        switch (sourceType) {
            case "video" -> requireConfigured(request.getLive_video_url(), "视频直播必须配置视频地址");
            case "stream" -> requireConfigured(request.getLive_stream_url(), "流直播必须配置播放流地址");
            case "camera" -> requireConfigured(request.getCamera_stream_key(), "摄像头直播必须配置推流通道");
            case "" -> throw badRequest("启用直播时必须选择直播源类型");
            default -> throw badRequest("直播源类型必须为 video、stream 或 camera");
        }
    }

    private void requireConfigured(String value, String message) {
        if (normalize(value).isBlank()) {
            throw badRequest(message);
        }
    }

    private String resolveDefaultExperience(
            ScenicStructuredSpotRecordRequest request,
            boolean audioEnabled,
            boolean liveEnabled
    ) {
        if (audioEnabled && liveEnabled) {
            return normalize(request.getDefault_experience()).toLowerCase();
        }
        if (audioEnabled) {
            return "audio";
        }
        if (liveEnabled) {
            return "live";
        }
        return null;
    }

    private ResponseStatusException badRequest(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
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

    private String normalizeNullable(String value) {
        String normalized = normalize(value);
        return normalized.isBlank() ? null : normalized;
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
