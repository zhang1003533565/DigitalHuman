package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.VoiceScriptImportIssueDto;
import com.digitalhuman.backend_java.dto.VoiceScriptImportResponse;
import com.digitalhuman.backend_java.dto.VoiceScriptSceneRequest;
import com.digitalhuman.backend_java.model.VoiceScriptScene;
import com.digitalhuman.backend_java.repository.VoiceScriptSceneRepository;
import jakarta.transaction.Transactional;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
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

    private final VoiceScriptSceneRepository repository;

    public VoiceScriptSceneService(VoiceScriptSceneRepository repository) {
        this.repository = repository;
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
        validateUniqueKey(request, null);

        VoiceScriptScene entity = new VoiceScriptScene();
        applyRequest(entity, request);
        return repository.save(entity);
    }

    @Transactional
    public VoiceScriptScene update(Long id, VoiceScriptSceneRequest request) {
        VoiceScriptScene entity = getById(id);
        validateRequestEnums(request);
        validateUniqueKey(request, id);

        applyRequest(entity, request);
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
    public VoiceScriptImportResponse importFromDocx(MultipartFile file, String scenicName, String style, Integer versionNo) {
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
            List<String> paragraphs = extractParagraphs(document);
            if (paragraphs.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文档内容为空");
            }

            String overviewText = mergeTexts(paragraphs.subList(0, Math.min(paragraphs.size(), 4)));
            if (overviewText.length() >= 100) {
                VoiceScriptScene overview = new VoiceScriptScene();
                overview.setScenicName(normalizedScenicName);
                overview.setSpotId("overview");
                overview.setSpotName(normalizedScenicName + "总览");
                overview.setSceneType("overview");
                overview.setStyle(normalizedStyle);
                overview.setTitle(normalizedScenicName + "总览讲解");
                overview.setScriptText(limitText(overviewText, 1150));
                overview.setSsmlText(toSimpleSsml(overview.getScriptText()));
                overview.setDurationSec(estimateDurationSec(overview.getScriptText()));
                overview.setVersionNo(versionNo);
                overview.setStatus("draft");
                overview.setSourceFile(originalFilename);
                saveReplacingIfExists(overview);
                importedCount++;
            } else {
                skippedCount++;
                issues.add(new VoiceScriptImportIssueDto(1, "总览段落不足100字，已跳过"));
            }

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

                String scriptText = normalize(block.toString());
                if (scriptText.length() < 100) {
                    skippedCount++;
                    issues.add(new VoiceScriptImportIssueDto(rowNum, "景点《" + title + "》正文不足100字，已跳过"));
                    rowNum++;
                    continue;
                }

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

    private void applyRequest(VoiceScriptScene entity, VoiceScriptSceneRequest request) {
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

    private List<String> extractParagraphs(XWPFDocument document) {
        List<String> rows = new ArrayList<>();
        for (XWPFParagraph paragraph : document.getParagraphs()) {
            String text = normalize(paragraph.getText());
            if (text.isBlank()) {
                continue;
            }
            if (text.startsWith("<w:")) {
                continue;
            }
            rows.add(text);
        }
        return rows;
    }

    private boolean isTopHeading(String text) {
        return text.contains("景区概况") || text.contains("核心文化") || text.contains("核心景点") || text.contains("游览指南") || text.contains("总结");
    }

    private boolean isSpotTitle(String text) {
        if (text.length() < 3 || text.length() > 30) {
            return false;
        }
        if (text.contains("：") || text.contains(":")) {
            return true;
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

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
