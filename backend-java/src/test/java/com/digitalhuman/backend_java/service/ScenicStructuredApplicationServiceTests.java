package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicFacilityContentRequest;
import com.digitalhuman.backend_java.dto.ScenicFacilityContentResponse;
import com.digitalhuman.backend_java.dto.ScenicStructuredApplyPreview;
import com.digitalhuman.backend_java.dto.ScenicStructuredApplyRequest;
import com.digitalhuman.backend_java.model.ScenicFacility;
import com.digitalhuman.backend_java.model.ScenicStructuredSpotRecord;
import com.digitalhuman.backend_java.repository.ScenicFacilityRepository;
import com.digitalhuman.backend_java.repository.ScenicStructuredApplicationSnapshotRepository;
import com.digitalhuman.backend_java.repository.ScenicStructuredSpotRecordRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ScenicStructuredApplicationServiceTests {

    @Test
    void previewReturnsIndependentFieldDiffsInsteadOfOneCombinedDetail() {
        Fixtures fixtures = fixtures();

        ScenicStructuredApplyPreview preview = fixtures.service.preview(8L, 12L);

        assertTrue(preview.getFields().stream().anyMatch(field ->
                field.getKey().equals("culturalConnotation")
                        && field.getImportedValue().equals("体现佛教文化")
                        && field.getCurrentValue().equals("旧文化内容")));
        assertTrue(preview.getFields().stream().anyMatch(field -> field.getKey().equals("highlights")));
        assertTrue(preview.getFields().stream().noneMatch(field -> field.getKey().equals("detail")));
    }

    @Test
    void fillEmptyKeepsOfficialNameAndFillsEmptySpotCodeLocationAndContentColumns() {
        Fixtures fixtures = fixtures();
        ScenicStructuredApplyRequest request = new ScenicStructuredApplyRequest();
        request.setFacilityId(12L);
        request.setMode("fill_empty");

        fixtures.service.apply(8L, request);

        ArgumentCaptor<ScenicFacility> facilityCaptor = ArgumentCaptor.forClass(ScenicFacility.class);
        verify(fixtures.facilityRepository).save(facilityCaptor.capture());
        assertEquals("正式名称", facilityCaptor.getValue().getName());
        assertEquals("LS-001", facilityCaptor.getValue().getSpotCode());
        assertEquals("秦履峰南侧", facilityCaptor.getValue().getLocationDescription());
        ArgumentCaptor<ScenicFacilityContentRequest> contentCaptor = ArgumentCaptor.forClass(ScenicFacilityContentRequest.class);
        verify(fixtures.contentService).saveContent(org.mockito.Mockito.eq(12L), contentCaptor.capture());
        assertEquals("旧文化内容", contentCaptor.getValue().getCulturalConnotation());
        assertEquals("登云道远眺太湖", contentCaptor.getValue().getHighlights());
        assertEquals(8L, contentCaptor.getValue().getSourceRecordId());
        assertEquals("applied", fixtures.record.getApplyStatus());
        assertEquals(12L, fixtures.record.getMatchedFacilityId());
    }

    @Test
    void selectedModeOnlyOverwritesExplicitFields() {
        Fixtures fixtures = fixtures();
        ScenicStructuredApplyRequest request = new ScenicStructuredApplyRequest();
        request.setFacilityId(12L);
        request.setMode("selected");
        request.setFields(List.of("culturalConnotation"));

        fixtures.service.apply(8L, request);

        ArgumentCaptor<ScenicFacilityContentRequest> contentCaptor = ArgumentCaptor.forClass(ScenicFacilityContentRequest.class);
        verify(fixtures.contentService).saveContent(org.mockito.Mockito.eq(12L), contentCaptor.capture());
        assertEquals("体现佛教文化", contentCaptor.getValue().getCulturalConnotation());
        assertEquals("", contentCaptor.getValue().getHighlights());
    }

    private Fixtures fixtures() {
        ScenicStructuredSpotRecordRepository recordRepository = mock(ScenicStructuredSpotRecordRepository.class);
        ScenicFacilityRepository facilityRepository = mock(ScenicFacilityRepository.class);
        ScenicStructuredApplicationSnapshotRepository snapshotRepository = mock(ScenicStructuredApplicationSnapshotRepository.class);
        ScenicFacilityContentService contentService = mock(ScenicFacilityContentService.class);
        ScenicStructuredSpotRecord record = record();
        ScenicFacility facility = facility();
        ScenicFacilityContentResponse currentContent = new ScenicFacilityContentResponse();
        currentContent.setCulturalConnotation("旧文化内容");
        currentContent.setHighlights("");
        when(recordRepository.findById(8L)).thenReturn(Optional.of(record));
        when(recordRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(facilityRepository.findByIdAndDeletedAtIsNull(12L)).thenReturn(Optional.of(facility));
        when(facilityRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(contentService.getContent(12L)).thenReturn(currentContent);
        when(contentService.saveContent(any(), any())).thenAnswer(invocation -> {
            ScenicFacilityContentRequest request = invocation.getArgument(1);
            ScenicFacilityContentResponse response = new ScenicFacilityContentResponse();
            response.setFacilityId(12L);
            response.setCulturalConnotation(request.getCulturalConnotation());
            response.setHighlights(request.getHighlights());
            return response;
        });
        ScenicStructuredApplicationService service = new ScenicStructuredApplicationService(
                recordRepository, facilityRepository, contentService, snapshotRepository, new ObjectMapper());
        return new Fixtures(service, facilityRepository, contentService, record);
    }

    private ScenicStructuredSpotRecord record() {
        ScenicStructuredSpotRecord record = new ScenicStructuredSpotRecord();
        record.setId(8L);
        record.setSpot_id("LS-001");
        record.setSpot_name("灵山大佛");
        record.setLocation("秦履峰南侧");
        record.setArchitecture_landscape_params("通高八十八米");
        record.setCore_function("佛教文化地标");
        record.setCultural_connotation("体现佛教文化");
        record.setDetailed_introduction("景区核心文化地标");
        record.setHighlights("登云道远眺太湖");
        record.setPerformance_open_info("08:30-17:00");
        record.setRemark("导入来源");
        return record;
    }

    private ScenicFacility facility() {
        ScenicFacility facility = new ScenicFacility();
        facility.setId(12L);
        facility.setName("正式名称");
        facility.setSpotCode(null);
        facility.setShortDescription("已有简介");
        facility.setLocationDescription(null);
        return facility;
    }

    private record Fixtures(
            ScenicStructuredApplicationService service,
            ScenicFacilityRepository facilityRepository,
            ScenicFacilityContentService contentService,
            ScenicStructuredSpotRecord record) {
    }
}
