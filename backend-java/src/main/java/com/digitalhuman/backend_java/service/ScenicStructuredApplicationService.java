package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicFacilityContentRequest;
import com.digitalhuman.backend_java.dto.ScenicFacilityContentResponse;
import com.digitalhuman.backend_java.dto.ScenicStructuredApplyPreview;
import com.digitalhuman.backend_java.dto.ScenicStructuredApplyRequest;
import com.digitalhuman.backend_java.model.ScenicFacility;
import com.digitalhuman.backend_java.model.ScenicStructuredApplicationSnapshot;
import com.digitalhuman.backend_java.model.ScenicStructuredSpotRecord;
import com.digitalhuman.backend_java.repository.ScenicFacilityRepository;
import com.digitalhuman.backend_java.repository.ScenicStructuredApplicationSnapshotRepository;
import com.digitalhuman.backend_java.repository.ScenicStructuredSpotRecordRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ScenicStructuredApplicationService {
    private final ScenicStructuredSpotRecordRepository recordRepository;
    private final ScenicFacilityRepository facilityRepository;
    private final ScenicFacilityContentService contentService;
    private final ScenicStructuredApplicationSnapshotRepository snapshotRepository;
    private final ObjectMapper objectMapper;

    public ScenicStructuredApplicationService(
            ScenicStructuredSpotRecordRepository recordRepository,
            ScenicFacilityRepository facilityRepository,
            ScenicFacilityContentService contentService,
            ScenicStructuredApplicationSnapshotRepository snapshotRepository,
            ObjectMapper objectMapper) {
        this.recordRepository = recordRepository;
        this.facilityRepository = facilityRepository;
        this.contentService = contentService;
        this.snapshotRepository = snapshotRepository;
        this.objectMapper = objectMapper;
    }

    public ScenicStructuredApplyPreview preview(Long recordId, Long facilityId) {
        ScenicStructuredSpotRecord source = findRecord(recordId);
        ScenicFacility facility = findFacility(facilityId);
        ScenicFacilityContentResponse content = contentService.getContent(facilityId);
        return new ScenicStructuredApplyPreview(recordId, facilityId, diffs(source, facility, content));
    }

    @Transactional
    public ScenicFacilityContentResponse apply(Long recordId, ScenicStructuredApplyRequest request) {
        ScenicStructuredSpotRecord source = findRecord(recordId);
        ScenicFacility facility = findFacility(request.getFacilityId());
        ScenicFacilityContentResponse current = contentService.getContent(facility.getId());
        saveSnapshot(source, facility, current);
        Set<String> selected = Set.copyOf(request.getFields() == null ? List.of() : request.getFields());
        String mode = normalizeMode(request.getMode());

        String nextSpotCode = choose("spotCode", facility.getSpotCode(), source.getSpot_id(), mode, selected);
        if (!isBlank(nextSpotCode)
                && !nextSpotCode.equalsIgnoreCase(value(facility.getSpotCode()))
                && facilityRepository.existsBySpotCodeIgnoreCaseAndDeletedAtIsNullAndIdNot(nextSpotCode, facility.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "景点编码已被其他正式景点使用");
        }
        facility.setSpotCode(nextSpotCode);
        String nextName = choose("name", facility.getName(), source.getSpot_name(), mode, selected);
        facility.setName(isBlank(nextName) ? facility.getName() : nextName);
        facility.setLocationDescription(choose("locationDescription", facility.getLocationDescription(), source.getLocation(), mode, selected));
        facilityRepository.save(facility);

        ScenicFacilityContentRequest next = copyContent(current);
        next.setArchitectureLandscapeParams(choose("architectureLandscapeParams", current.getArchitectureLandscapeParams(), source.getArchitecture_landscape_params(), mode, selected));
        next.setCoreFunction(choose("coreFunction", current.getCoreFunction(), source.getCore_function(), mode, selected));
        next.setCulturalConnotation(choose("culturalConnotation", current.getCulturalConnotation(), source.getCultural_connotation(), mode, selected));
        next.setDetailedIntroduction(choose("detailedIntroduction", current.getDetailedIntroduction(), source.getDetailed_introduction(), mode, selected));
        next.setHighlights(choose("highlights", current.getHighlights(), source.getHighlights(), mode, selected));
        next.setPerformanceOpenInfo(choose("performanceOpenInfo", current.getPerformanceOpenInfo(), source.getPerformance_open_info(), mode, selected));
        next.setRemark(choose("remark", current.getRemark(), source.getRemark(), mode, selected));
        next.setSourceRecordId(source.getId());
        ScenicFacilityContentResponse saved = contentService.saveContent(facility.getId(), next);

        source.setMatchedFacilityId(facility.getId());
        source.setMatchStatus("matched");
        source.setApplyStatus("applied");
        source.setLastAppliedAt(LocalDateTime.now());
        recordRepository.save(source);
        return saved;
    }

    @Transactional
    public ScenicStructuredSpotRecord match(Long recordId, Long facilityId) {
        ScenicStructuredSpotRecord record = findRecord(recordId);
        findFacility(facilityId);
        record.setMatchedFacilityId(facilityId);
        record.setMatchStatus("matched");
        if (!"applied".equals(record.getApplyStatus())) record.setApplyStatus("pending");
        return recordRepository.save(record);
    }

    private List<ScenicStructuredApplyPreview.FieldDiff> diffs(
            ScenicStructuredSpotRecord source, ScenicFacility facility, ScenicFacilityContentResponse content) {
        List<ScenicStructuredApplyPreview.FieldDiff> values = new ArrayList<>();
        values.add(diff("spotCode", "景点编码", facility.getSpotCode(), source.getSpot_id()));
        values.add(diff("name", "景点名称", facility.getName(), source.getSpot_name()));
        values.add(diff("locationDescription", "具体位置", facility.getLocationDescription(), source.getLocation()));
        values.add(diff("architectureLandscapeParams", "建筑/景观参数", content.getArchitectureLandscapeParams(), source.getArchitecture_landscape_params()));
        values.add(diff("coreFunction", "核心功能", content.getCoreFunction(), source.getCore_function()));
        values.add(diff("culturalConnotation", "文化内涵", content.getCulturalConnotation(), source.getCultural_connotation()));
        values.add(diff("detailedIntroduction", "详细介绍", content.getDetailedIntroduction(), source.getDetailed_introduction()));
        values.add(diff("highlights", "游玩亮点", content.getHighlights(), source.getHighlights()));
        values.add(diff("performanceOpenInfo", "演艺/开放信息", content.getPerformanceOpenInfo(), source.getPerformance_open_info()));
        values.add(diff("remark", "备注", content.getRemark(), source.getRemark()));
        return values;
    }

    private ScenicStructuredApplyPreview.FieldDiff diff(String key, String label, String current, String imported) {
        return new ScenicStructuredApplyPreview.FieldDiff(key, label, current, imported);
    }

    private String choose(String key, String current, String imported, String mode, Set<String> selected) {
        if ("overwrite_all".equals(mode)) return clean(imported);
        if ("selected".equals(mode)) return selected.contains(key) ? clean(imported) : current;
        return isBlank(current) ? clean(imported) : current;
    }

    private ScenicFacilityContentRequest copyContent(ScenicFacilityContentResponse current) {
        ScenicFacilityContentRequest next = new ScenicFacilityContentRequest();
        next.setArchitectureLandscapeParams(value(current.getArchitectureLandscapeParams()));
        next.setCoreFunction(value(current.getCoreFunction()));
        next.setCulturalConnotation(value(current.getCulturalConnotation()));
        next.setDetailedIntroduction(value(current.getDetailedIntroduction()));
        next.setHighlights(value(current.getHighlights()));
        next.setPerformanceOpenInfo(value(current.getPerformanceOpenInfo()));
        next.setVisitorNotes(value(current.getVisitorNotes()));
        next.setRemark(value(current.getRemark()));
        next.setAudioEnabled(current.getAudioEnabled());
        next.setLiveEnabled(current.getLiveEnabled());
        next.setDefaultExperience(current.getDefaultExperience());
        next.setBoundVoiceScriptId(current.getBoundVoiceScriptId());
        next.setLiveSourceType(current.getLiveSourceType());
        next.setLiveVideoUrl(current.getLiveVideoUrl());
        next.setLiveStreamUrl(current.getLiveStreamUrl());
        next.setCameraStreamKey(current.getCameraStreamKey());
        next.setLiveDigitalHumanModelId(current.getLiveDigitalHumanModelId());
        return next;
    }

    private void saveSnapshot(ScenicStructuredSpotRecord source, ScenicFacility facility, ScenicFacilityContentResponse content) {
        ScenicStructuredApplicationSnapshot snapshot = new ScenicStructuredApplicationSnapshot();
        snapshot.setSourceRecordId(source.getId());
        snapshot.setFacilityId(facility.getId());
        Map<String, Object> facilityValues = new LinkedHashMap<>();
        facilityValues.put("spotCode", facility.getSpotCode());
        facilityValues.put("name", facility.getName());
        facilityValues.put("shortDescription", facility.getShortDescription());
        facilityValues.put("locationDescription", facility.getLocationDescription());
        try {
            snapshot.setFacilitySnapshotJson(objectMapper.writeValueAsString(facilityValues));
            snapshot.setContentSnapshotJson(objectMapper.writeValueAsString(content));
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "无法保存应用前快照");
        }
        snapshotRepository.save(snapshot);
    }

    private String normalizeMode(String mode) {
        String value = clean(mode);
        if (value == null) return "fill_empty";
        if (!List.of("fill_empty", "selected", "overwrite_all").contains(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的应用方式");
        }
        return value;
    }
    private ScenicStructuredSpotRecord findRecord(Long id) { return recordRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "导入记录不存在")); }
    private ScenicFacility findFacility(Long id) { return facilityRepository.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "正式景点不存在")); }
    private String clean(String text) { if (text == null) return null; String value = text.trim(); return value.isEmpty() ? null : value; }
    private String value(String text) { return text == null ? "" : text; }
    private boolean isBlank(String text) { return text == null || text.isBlank(); }
}
