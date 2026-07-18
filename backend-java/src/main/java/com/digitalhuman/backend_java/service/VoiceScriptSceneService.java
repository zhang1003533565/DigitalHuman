package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.VoiceScriptImportIssueDto;
import com.digitalhuman.backend_java.dto.VoiceScriptImportResponse;
import com.digitalhuman.backend_java.dto.VoiceScriptSceneRequest;
import com.digitalhuman.backend_java.dto.VoiceScriptSynthesizeRequest;
import com.digitalhuman.backend_java.dto.TtsRequest;
import com.digitalhuman.backend_java.model.VoiceScriptScene;
import com.digitalhuman.backend_java.repository.VoiceScriptSceneRepository;
import jakarta.transaction.Transactional;
import org.apache.poi.xwpf.usermodel.BodyElementType;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriUtils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class VoiceScriptSceneService {

    private static final Set<String> ALLOWED_STATUS = Set.of("draft", "published", "archived");
    private static final Set<String> ALLOWED_SCENE_TYPE = Set.of("overview", "spot", "transition");
    private static final Set<String> ALLOWED_STYLE = Set.of("culture", "family", "light");
    private static final List<String> STRUCTURED_HEADERS_ZH = List.of(
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
    private static final Set<String> NON_SPOT_SECTION_TITLES = Set.of(
            "住宿", "餐饮", "交通", "门票", "开放时间", "特色体验", "讲解重点", "实用游览贴士",
            "个性化游览路线推荐", "核心文化内涵", "游览指南", "总结", "温馨提示", "注意事项",
            "项目", "详细信息", "基本数据", "建造工艺", "佛教意义", "最佳体验", "建筑规模",
            "核心艺术", "文化地位", "表演内容", "建筑风格", "内部艺术", "历史遗存", "佛教活动"
    );

    private final VoiceScriptSceneRepository repository;
    private final TtsService ttsService;

    public VoiceScriptSceneService(VoiceScriptSceneRepository repository, TtsService ttsService) {
        this.repository = repository;
        this.ttsService = ttsService;
    }

    public List<VoiceScriptScene> listAll() {
        return repository.findAllByOrderByUpdatedAtDescIdDesc();
    }

    public VoiceScriptScene getById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "记录不存在"));
    }

    @Transactional
    public VoiceScriptScene create(VoiceScriptSceneRequest request) {
        validateRequestEnums(request);

        VoiceScriptScene entity = new VoiceScriptScene();
        applyRequest(entity, request);
        int nextVersion = repository.findTopBySpotIdAndSceneTypeAndStyleOrderByVersionNoDesc(
                        entity.getSpotId(), entity.getSceneType(), entity.getStyle())
                .map(VoiceScriptScene::getVersionNo)
                .orElse(0) + 1;
        entity.setVersionNo(nextVersion);
        entity.setStatus("draft");
        initializeManualDraft(entity);
        return repository.save(entity);
    }

    @Transactional
    public VoiceScriptScene update(Long id, VoiceScriptSceneRequest request) {
        VoiceScriptScene entity = getById(id);
        if (!"draft".equalsIgnoreCase(normalize(entity.getStatus()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已发布或已归档版本不可直接修改，请先回滚为新草稿");
        }
        validateRequestEnums(request);
        validateUniqueKey(request, id);

        String oldScriptText = entity.getScriptText();
        applyRequest(entity, request);
        if (!normalize(oldScriptText).equals(normalize(entity.getScriptText())) && hasAudioAsset(entity)) {
            entity.setAudioStatus("stale");
        }
        return repository.save(entity);
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "记录不存在");
        }
        repository.deleteById(id);
    }

    @Transactional
    public VoiceScriptScene publish(Long id) {
        VoiceScriptScene entity = getById(id);
        if (!hasCurrentReadyAudio(entity)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "发布前必须先为当前口播文本合成有效音频");
        }
        String spotId = normalize(entity.getSpotId());
        String sceneType = normalize(entity.getSceneType()).toLowerCase(Locale.ROOT);
        String style = normalize(entity.getStyle()).toLowerCase(Locale.ROOT);

        List<VoiceScriptScene> publishedRows = repository.findBySpotIdAndSceneTypeAndStyleAndStatusIgnoreCase(
                spotId, sceneType, style, "published");

        for (VoiceScriptScene row : publishedRows) {
            if (!row.getId().equals(id)) {
                row.setStatus("archived");
                repository.save(row);
            }
        }

        entity.setStatus("published");
        return repository.save(entity);
    }

    @Transactional
    public VoiceScriptScene rollback(Long id) {
        VoiceScriptScene source = getById(id);
        int nextVersion = repository.findTopBySpotIdAndSceneTypeAndStyleOrderByVersionNoDesc(
                        source.getSpotId(), source.getSceneType(), source.getStyle())
                .map(VoiceScriptScene::getVersionNo)
                .orElse(0) + 1;

        VoiceScriptScene draft = copyContent(source);
        draft.setVersionNo(nextVersion);
        draft.setStatus("draft");
        draft.setGenerationMode("manual");
        clearAudio(draft);
        return repository.save(draft);
    }

    public VoiceScriptScene synthesize(Long id, VoiceScriptSynthesizeRequest request) {
        VoiceScriptScene entity = getById(id);
        if (!"draft".equalsIgnoreCase(normalize(entity.getStatus()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "只有草稿版本允许直接合成，请先回滚为新草稿");
        }
        String voiceId = normalize(request.getVoiceId());
        String rate = defaultIfBlank(request.getSpeechRate(), "+0%");
        String volume = defaultIfBlank(request.getSpeechVolume(), "+0%");
        String pitch = defaultIfBlank(request.getSpeechPitch(), "+0Hz");
        TtsRequest ttsRequest = TtsRequest.builder()
                .text(entity.getScriptText())
                .voice(voiceId)
                .rate(rate)
                .volume(volume)
                .pitch(pitch)
                .outputFileName("voice-script-" + id + "-v" + entity.getVersionNo() + ".mp3")
                .build();

        try {
            String audioPath = ttsService.synthesize(ttsRequest);
            String audioFileName = Path.of(audioPath).getFileName().toString();
            entity.setAudioStatus("ready");
            entity.setAudioUrl("/api/tts/audio/" + UriUtils.encodePathSegment(audioFileName, StandardCharsets.UTF_8));
            entity.setAudioFileName(audioFileName);
            entity.setVoiceId(voiceId);
            entity.setSpeechRate(rate);
            entity.setSpeechVolume(volume);
            entity.setSpeechPitch(pitch);
            entity.setAudioScriptHash(scriptHash(entity.getScriptText()));
            entity.setAudioGeneratedAt(LocalDateTime.now());
            return repository.save(entity);
        } catch (Exception exception) {
            entity.setAudioStatus("failed");
            repository.save(entity);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "语音合成失败：" + exception.getMessage(), exception);
        }
    }

    public List<VoiceScriptScene> listPublished(String spotId) {
        String normalizedSpotId = normalize(spotId);
        if (normalizedSpotId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "景点ID不能为空");
        }
        return repository.findBySpotIdAndStatusIgnoreCaseOrderByVersionNoDesc(normalizedSpotId, "published")
                .stream()
                .filter(VoiceScriptSceneService::hasCurrentReadyAudio)
                .toList();
    }

    public static String scriptHash(String scriptText) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest((scriptText == null ? "" : scriptText).getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    public static boolean hasCurrentReadyAudio(VoiceScriptScene entity) {
        return entity != null
                && "ready".equalsIgnoreCase(normalizeStatic(entity.getAudioStatus()))
                && scriptHash(entity.getScriptText()).equals(normalizeStatic(entity.getAudioScriptHash()))
                && !normalizeStatic(entity.getAudioUrl()).isBlank();
    }

    @Transactional
    public VoiceScriptImportResponse importFromDocx(MultipartFile file, String scenicName, String style, Integer versionNo) {
        return importFromDocx(file, scenicName, style, versionNo, false);
    }

    @Transactional
    public VoiceScriptImportResponse importFromDocx(MultipartFile file, String scenicName, String style, Integer versionNo, boolean replaceAll) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "上传文件不能为空");
        }

        String normalizedScenicName = normalize(scenicName);
        if (normalizedScenicName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "景区名称不能为空");
        }

        String normalizedStyle = normalize(style).toLowerCase(Locale.ROOT);
        if (!ALLOWED_STYLE.contains(normalizedStyle)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "style 仅支持 culture/family/light");
        }

        if (versionNo == null || versionNo < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "版本号必须大于等于1");
        }

        String originalFilename = normalize(file.getOriginalFilename());
        if (!originalFilename.toLowerCase(Locale.ROOT).endsWith(".docx")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅支持 .docx 文件");
        }

        List<VoiceScriptImportIssueDto> issues = new ArrayList<>();
        int importedCount = 0;
        int skippedCount = 0;

        try (InputStream inputStream = file.getInputStream(); XWPFDocument document = new XWPFDocument(inputStream)) {
            List<XWPFTable> structuredTables = findStructuredTables(document);
            if (!structuredTables.isEmpty()) {
                if (replaceAll) {
                    repository.deleteAllInBatch();
                }
                return importFromStructuredTables(structuredTables, normalizedScenicName, normalizedStyle, versionNo, originalFilename);
            }

            List<String> paragraphs = extractDocumentTexts(document);
            if (paragraphs.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文档内容为空");
            }
            if (replaceAll) {
                repository.deleteAllInBatch();
            }

            String overviewText = mergeTexts(paragraphs.subList(0, Math.min(paragraphs.size(), 4)));
            VoiceScriptScene overview = new VoiceScriptScene();
            overview.setScenicName(normalizedScenicName);
            overview.setSpotId("overview");
            overview.setSpotName(normalizedScenicName + "总览");
            overview.setSceneType("overview");
            overview.setStyle(normalizedStyle);
            overview.setTitle(normalizedScenicName + "总览讲解");
            overview.setScriptText(limitText(nonBlankOrFallback(overviewText, normalizedScenicName + "总览讲解草稿"), 1150));
            overview.setSsmlText(toSimpleSsml(overview.getScriptText()));
            overview.setDurationSec(estimateDurationSec(overview.getScriptText()));
            overview.setVersionNo(versionNo);
            overview.setStatus("draft");
            overview.setSourceFile(originalFilename);
            saveReplacingIfExists(overview);
            importedCount++;

            int rowNum = 2;
            Set<String> inDocSpotIds = new HashSet<>();
            for (int i = 0; i < paragraphs.size(); i++) {
                String title = paragraphs.get(i);
                if (!isSpotTitle(title)) {
                    continue;
                }

                StringBuilder block = new StringBuilder();
                int j = i + 1;
                while (j < paragraphs.size() && !isTopHeading(paragraphs.get(j)) && !isSpotTitle(paragraphs.get(j))) {
                    String text = paragraphs.get(j);
                    if (text.length() > 8) {
                        if (!block.isEmpty()) {
                            block.append("\n");
                        }
                        block.append(text);
                    }
                    j++;
                }

                String scriptText = nonBlankOrFallback(block.toString(), title + "讲解草稿");

                String spotId = buildSpotId(title);
                if (inDocSpotIds.contains(spotId)) {
                    skippedCount++;
                    issues.add(new VoiceScriptImportIssueDto(rowNum, "景点《" + title + "》在文档中重复，已跳过"));
                    rowNum++;
                    continue;
                }
                inDocSpotIds.add(spotId);

                VoiceScriptScene scene = new VoiceScriptScene();
                scene.setScenicName(normalizedScenicName);
                scene.setSpotId(spotId);
                scene.setSpotName(title);
                scene.setSceneType("spot");
                scene.setStyle(normalizedStyle);
                scene.setTitle(title + "讲解");
                scene.setScriptText(limitText(scriptText, 1150));
                scene.setSsmlText(toSimpleSsml(scene.getScriptText()));
                scene.setDurationSec(estimateDurationSec(scene.getScriptText()));
                scene.setVersionNo(versionNo);
                scene.setStatus("draft");
                scene.setSourceFile(originalFilename);

                saveReplacingIfExists(scene);
                importedCount++;
                rowNum++;
            }

            int total = repository.findAll().size();
            return new VoiceScriptImportResponse(importedCount, total, skippedCount, issues);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "读取 DOCX 失败：" + exception.getMessage());
        }
    }

    private VoiceScriptImportResponse importFromStructuredTables(
            List<XWPFTable> structuredTables,
            String defaultScenicName,
            String style,
            Integer versionNo,
            String sourceFile) {
        List<VoiceScriptImportIssueDto> issues = new ArrayList<>();
        int importedCount = 0;
        int skippedCount = 0;
        Set<String> inDocSpotIds = new HashSet<>();
        int logicalRowNumber = 1;

        for (XWPFTable table : structuredTables) {
            List<XWPFTableRow> rows = table.getRows();
            for (int rowIndex = 1; rowIndex < rows.size(); rowIndex++) {
                logicalRowNumber++;
                XWPFTableRow row = rows.get(rowIndex);
                StructuredSpotDraft draft = structuredSpotFromRow(row);
                if (draft.empty()) {
                    skippedCount++;
                    continue;
                }
                if (draft.spotId().isBlank() || draft.spotName().isBlank()) {
                    skippedCount++;
                    issues.add(new VoiceScriptImportIssueDto(logicalRowNumber, "景点ID或景点名称为空，已跳过"));
                    continue;
                }
                if (inDocSpotIds.contains(draft.spotId())) {
                    skippedCount++;
                    issues.add(new VoiceScriptImportIssueDto(logicalRowNumber, "景点《" + draft.spotName() + "》在文档中重复，已跳过"));
                    continue;
                }

                String scriptText = nonBlankOrFallback(buildStructuredScriptText(draft), draft.spotName() + "讲解草稿");

                inDocSpotIds.add(draft.spotId());
                VoiceScriptScene scene = new VoiceScriptScene();
                scene.setScenicName(draft.scenicName().isBlank() ? defaultScenicName : draft.scenicName());
                scene.setSpotId(draft.spotId());
                scene.setSpotName(draft.spotName());
                scene.setSceneType("spot");
                scene.setStyle(style);
                scene.setTitle(draft.spotName() + "讲解");
                scene.setScriptText(limitText(scriptText, 1150));
                scene.setSsmlText(toSimpleSsml(scene.getScriptText()));
                scene.setDurationSec(estimateDurationSec(scene.getScriptText()));
                scene.setVersionNo(versionNo);
                scene.setStatus("draft");
                scene.setSourceFile(sourceFile);
                saveReplacingIfExists(scene);
                importedCount++;
            }
        }

        int total = repository.findAll().size();
        return new VoiceScriptImportResponse(importedCount, total, skippedCount, issues);
    }

    private void applyRequest(VoiceScriptScene entity, VoiceScriptSceneRequest request) {
        entity.setFacilityId(request.getFacilityId());
        entity.setScenicName(normalize(request.getScenicName()));
        entity.setSpotId(normalize(request.getSpotId()));
        entity.setSpotName(normalize(request.getSpotName()));
        entity.setSceneType(normalize(request.getSceneType()).toLowerCase(Locale.ROOT));
        entity.setStyle(normalize(request.getStyle()).toLowerCase(Locale.ROOT));
        entity.setTitle(normalize(request.getTitle()));
        entity.setScriptText(normalize(request.getScriptText()));
        entity.setSsmlText(normalize(request.getSsmlText()));
        entity.setDurationSec(request.getDurationSec());
        entity.setVersionNo(request.getVersionNo());
        entity.setStatus(normalize(request.getStatus()).toLowerCase(Locale.ROOT));
        entity.setSourceFile(normalize(request.getSourceFile()));
    }

    private void initializeManualDraft(VoiceScriptScene entity) {
        entity.setGenerationMode("manual");
        entity.setTargetDurationSec(entity.getDurationSec());
        entity.setAudioStatus("missing");
    }

    private VoiceScriptScene copyContent(VoiceScriptScene source) {
        VoiceScriptScene copy = new VoiceScriptScene();
        copy.setFacilityId(source.getFacilityId());
        copy.setScenicName(source.getScenicName());
        copy.setSpotId(source.getSpotId());
        copy.setSpotName(source.getSpotName());
        copy.setSceneType(source.getSceneType());
        copy.setStyle(source.getStyle());
        copy.setTitle(source.getTitle());
        copy.setScriptText(source.getScriptText());
        copy.setSsmlText(source.getSsmlText());
        copy.setDurationSec(source.getDurationSec());
        copy.setTargetDurationSec(source.getTargetDurationSec());
        copy.setSourceFile(source.getSourceFile());
        copy.setSourceRefsJson(source.getSourceRefsJson());
        return copy;
    }

    private void clearAudio(VoiceScriptScene entity) {
        entity.setAudioStatus("missing");
        entity.setAudioUrl(null);
        entity.setAudioFileName(null);
        entity.setVoiceId(null);
        entity.setSpeechRate(null);
        entity.setSpeechVolume(null);
        entity.setSpeechPitch(null);
        entity.setAudioScriptHash(null);
        entity.setAudioGeneratedAt(null);
    }

    private boolean hasAudioAsset(VoiceScriptScene entity) {
        return "ready".equalsIgnoreCase(normalize(entity.getAudioStatus()))
                || "stale".equalsIgnoreCase(normalize(entity.getAudioStatus()))
                || !normalize(entity.getAudioUrl()).isBlank()
                || !normalize(entity.getAudioScriptHash()).isBlank();
    }

    private String defaultIfBlank(String value, String fallback) {
        String normalized = normalize(value);
        return normalized.isBlank() ? fallback : normalized;
    }

    private void validateRequestEnums(VoiceScriptSceneRequest request) {
        String sceneType = normalize(request.getSceneType()).toLowerCase(Locale.ROOT);
        if (!ALLOWED_SCENE_TYPE.contains(sceneType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sceneType 仅支持 overview/spot/transition");
        }

        String style = normalize(request.getStyle()).toLowerCase(Locale.ROOT);
        if (!ALLOWED_STYLE.contains(style)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "style 仅支持 culture/family/light");
        }

        String status = normalize(request.getStatus()).toLowerCase(Locale.ROOT);
        if (!ALLOWED_STATUS.contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status 仅支持 draft/published/archived");
        }
    }

    private void validateUniqueKey(VoiceScriptSceneRequest request, Long currentId) {
        String spotId = normalize(request.getSpotId());
        String sceneType = normalize(request.getSceneType()).toLowerCase(Locale.ROOT);
        String style = normalize(request.getStyle()).toLowerCase(Locale.ROOT);
        Integer versionNo = request.getVersionNo();

        boolean exists = currentId == null
                ? repository.findBySpotIdAndSceneTypeAndStyleAndVersionNo(spotId, sceneType, style, versionNo).isPresent()
                : repository.findBySpotIdAndSceneTypeAndStyleAndVersionNoAndIdNot(spotId, sceneType, style, versionNo, currentId).isPresent();

        if (exists) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "同一景点/场景/风格/版本已存在");
        }
    }

    private void saveReplacingIfExists(VoiceScriptScene newRow) {
        repository.findBySpotIdAndSceneTypeAndStyleAndVersionNo(
                newRow.getSpotId(), newRow.getSceneType(), newRow.getStyle(), newRow.getVersionNo())
                .ifPresent(repository::delete);
        repository.save(newRow);
    }

    private List<String> extractDocumentTexts(XWPFDocument document) {
        List<String> rows = new ArrayList<>();
        for (IBodyElement element : document.getBodyElements()) {
            if (element.getElementType() == BodyElementType.PARAGRAPH && element instanceof XWPFParagraph paragraph) {
                addDocumentText(rows, paragraph.getText());
            } else if (element.getElementType() == BodyElementType.TABLE && element instanceof XWPFTable table) {
                rows.addAll(tableTexts(table));
            }
        }
        return rows;
    }

    private List<String> tableTexts(XWPFTable table) {
        List<String> rows = new ArrayList<>();
        for (XWPFTableRow row : table.getRows()) {
            List<XWPFTableCell> cells = row.getTableCells();
            if (cells.size() >= 2) {
                String key = normalize(cells.get(0).getText());
                String value = normalize(cells.get(1).getText());
                if (!key.isBlank() && !value.isBlank() && !"项目".equals(key) && !"详细信息".equals(value)) {
                    addDocumentText(rows, key + "：" + value);
                }
                continue;
            }
            String rowText = normalize(row.getTableCells().stream().map(XWPFTableCell::getText).reduce("", (left, right) -> left + " " + right));
            addDocumentText(rows, rowText);
        }
        return rows;
    }

    private void addDocumentText(List<String> rows, String value) {
        String text = normalize(value);
        if (text.isBlank() || text.startsWith("<w:")) {
            return;
        }
        rows.add(text);
    }

    private List<XWPFTable> findStructuredTables(XWPFDocument document) {
        List<XWPFTable> matchedTables = new ArrayList<>();
        for (XWPFTable table : document.getTables()) {
            List<XWPFTableRow> rows = table.getRows();
            if (rows == null || rows.isEmpty()) {
                continue;
            }
            XWPFTableRow headerRow = rows.get(0);
            List<String> headers = new ArrayList<>();
            for (int index = 0; index < STRUCTURED_HEADERS_ZH.size(); index++) {
                headers.add(normalize(getCellText(headerRow, index)));
            }
            if (STRUCTURED_HEADERS_ZH.equals(headers)) {
                matchedTables.add(table);
            }
        }
        return matchedTables;
    }

    private StructuredSpotDraft structuredSpotFromRow(XWPFTableRow row) {
        String scenicName = normalize(getCellText(row, 0));
        String spotId = normalize(getCellText(row, 1));
        String spotName = normalize(getCellText(row, 2));
        String location = normalize(getCellText(row, 3));
        String architecture = normalize(getCellText(row, 4));
        String function = normalize(getCellText(row, 5));
        String culture = normalize(getCellText(row, 6));
        String introduction = normalize(getCellText(row, 7));
        String highlights = normalize(getCellText(row, 8));
        String performance = normalize(getCellText(row, 9));
        String remark = normalize(getCellText(row, 10));
        boolean empty = List.of(
                scenicName, spotId, spotName, location, architecture, function, culture, introduction, highlights, performance, remark
        ).stream().allMatch(String::isBlank);
        return new StructuredSpotDraft(
                scenicName, spotId, spotName, location, architecture, function, culture, introduction, highlights, performance, remark, empty
        );
    }

    private String buildStructuredScriptText(StructuredSpotDraft draft) {
        List<String> parts = new ArrayList<>();
        if (!draft.introduction().isBlank()) {
            parts.add(draft.introduction());
        }
        if (!draft.culture().isBlank()) {
            parts.add("它的文化看点是：" + draft.culture());
        }
        if (!draft.architecture().isBlank()) {
            parts.add("建筑与景观特色包括：" + draft.architecture());
        }
        if (!draft.function().isBlank()) {
            parts.add("这里的核心体验是：" + draft.function());
        }
        if (!draft.highlights().isBlank()) {
            parts.add("游览时可以重点留意：" + draft.highlights());
        }
        if (!draft.performance().isBlank()) {
            parts.add("开放或演艺信息：" + draft.performance());
        }
        if (!draft.location().isBlank()) {
            parts.add("位置提示：" + draft.location());
        }
        if (!draft.remark().isBlank()) {
            parts.add(draft.remark());
        }
        return normalize(String.join("\n", parts));
    }

    private String getCellText(XWPFTableRow row, int index) {
        if (row == null || index < 0 || index >= row.getTableCells().size()) {
            return "";
        }
        XWPFTableCell cell = row.getCell(index);
        return cell == null ? "" : cell.getText();
    }

    private boolean isTopHeading(String text) {
        return text.contains("景区概况") || text.contains("核心文化") || text.contains("核心景点") || text.contains("游览指南") || text.contains("总结");
    }

    private boolean isSpotTitle(String text) {
        if (text.length() < 3 || text.length() > 30) {
            return false;
        }
        if (isTopHeading(text) || text.contains("游览指南")) {
            return false;
        }
        String normalized = text.replace("：", ":");
        String beforeColon = normalized.contains(":") ? normalized.substring(0, normalized.indexOf(':')).trim() : normalized;
        if (NON_SPOT_SECTION_TITLES.contains(beforeColon)) {
            return false;
        }
        if (text.contains("：") || text.contains(":")) {
            return text.contains("景点") || text.contains("寺") || text.contains("宫") || text.contains("塔")
                    || text.contains("佛") || text.contains("广场") || text.contains("坛城") || text.contains("湾");
        }
        return text.endsWith("寺") || text.endsWith("宫") || text.endsWith("塔") || text.endsWith("佛") || text.endsWith("广场") || text.endsWith("坛城");
    }

    private String buildSpotId(String title) {
        String cleaned = title.replace("：", "-").replace(":", "-");
        cleaned = cleaned.replaceAll("\\s+", "-");
        cleaned = cleaned.replaceAll("[^\\p{IsHan}a-zA-Z0-9_-]", "");
        if (cleaned.length() > 40) {
            cleaned = cleaned.substring(0, 40);
        }
        return cleaned.isBlank() ? "spot-unknown" : cleaned;
    }

    private String mergeTexts(List<String> texts) {
        return normalize(String.join("\n", texts));
    }

    private String toSimpleSsml(String scriptText) {
        String normalized = normalize(scriptText)
                .replace("。", "。<break time=\"600ms\"/>")
                .replace("！", "！<break time=\"500ms\"/>")
                .replace("？", "？<break time=\"500ms\"/>");
        return "<speak version=\"1.0\" xml:lang=\"zh-CN\">" + normalized + "</speak>";
    }

    private int estimateDurationSec(String text) {
        int count = normalize(text).length();
        int estimated = (int) Math.ceil(count / 4.2);
        return Math.max(30, Math.min(900, estimated));
    }

    private String limitText(String text, int max) {
        String normalized = normalize(text);
        if (normalized.length() <= max) {
            return normalized;
        }
        return normalized.substring(0, max);
    }

    private String nonBlankOrFallback(String value, String fallback) {
        String normalized = normalize(value);
        return normalized.isBlank() ? normalize(fallback) : normalized;
    }

    private static String normalizeStatic(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalize(String value) {
        return normalizeStatic(value);
    }

    private record StructuredSpotDraft(
            String scenicName,
            String spotId,
            String spotName,
            String location,
            String architecture,
            String function,
            String culture,
            String introduction,
            String highlights,
            String performance,
            String remark,
            boolean empty
    ) {
    }
}
