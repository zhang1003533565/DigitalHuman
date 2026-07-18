package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicFacilityDto;
import com.digitalhuman.backend_java.dto.ScenicFacilityRequestDto;
import com.digitalhuman.backend_java.model.FacilityCategory;
import com.digitalhuman.backend_java.model.ScenicFacility;
import com.digitalhuman.backend_java.repository.FacilityCategoryRepository;
import com.digitalhuman.backend_java.repository.ScenicFacilityRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminScenicFacilityServiceTests {

    @Test
    void savesOfficialSpotCodeSummaryLocationAndVisibilityAsFirstClassFields() {
        ScenicFacilityRepository facilityRepository = mock(ScenicFacilityRepository.class);
        FacilityCategoryRepository categoryRepository = mock(FacilityCategoryRepository.class);
        ScenicKnowledgePublicationService publicationService = mock(ScenicKnowledgePublicationService.class);
        FacilityCategory category = category();
        when(categoryRepository.findByIdAndDeletedAtIsNull(3L)).thenReturn(Optional.of(category));
        when(facilityRepository.existsBySpotCodeIgnoreCaseAndDeletedAtIsNull("LS-001")).thenReturn(false);
        when(facilityRepository.save(any(ScenicFacility.class))).thenAnswer(invocation -> {
            ScenicFacility facility = invocation.getArgument(0);
            facility.setId(12L);
            return facility;
        });
        AdminScenicFacilityService service = new AdminScenicFacilityService(
                facilityRepository, categoryRepository, new ObjectMapper(), publicationService);

        ScenicFacilityDto result = service.createFacility(request());

        assertEquals("LS-001", result.getSpotCode());
        assertEquals("世界最高露天青铜释迦牟尼立像", result.getShortDescription());
        assertEquals("秦履峰南侧", result.getLocationDescription());
        assertFalse(result.getMapVisible());
    }

    @Test
    void rejectsDuplicateOfficialSpotCode() {
        ScenicFacilityRepository facilityRepository = mock(ScenicFacilityRepository.class);
        FacilityCategoryRepository categoryRepository = mock(FacilityCategoryRepository.class);
        ScenicKnowledgePublicationService publicationService = mock(ScenicKnowledgePublicationService.class);
        when(categoryRepository.findByIdAndDeletedAtIsNull(3L)).thenReturn(Optional.of(category()));
        when(facilityRepository.existsBySpotCodeIgnoreCaseAndDeletedAtIsNull("LS-001")).thenReturn(true);
        AdminScenicFacilityService service = new AdminScenicFacilityService(
                facilityRepository, categoryRepository, new ObjectMapper(), publicationService);

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.createFacility(request()));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertEquals("景点编码已存在", error.getReason());
    }

    @Test
    void updateFacilityMarksLatestPublishedKnowledgeAsOutdatedAfterOfficialChanges() {
        ScenicFacilityRepository facilityRepository = mock(ScenicFacilityRepository.class);
        FacilityCategoryRepository categoryRepository = mock(FacilityCategoryRepository.class);
        ScenicKnowledgePublicationService publicationService = mock(ScenicKnowledgePublicationService.class);
        FacilityCategory category = category();
        ScenicFacility existing = new ScenicFacility();
        existing.setId(12L);
        existing.setCategory(category);
        when(categoryRepository.findByIdAndDeletedAtIsNull(3L)).thenReturn(Optional.of(category));
        when(facilityRepository.findByIdAndDeletedAtIsNull(12L)).thenReturn(Optional.of(existing));
        when(facilityRepository.existsBySpotCodeIgnoreCaseAndDeletedAtIsNullAndIdNot("LS-001", 12L)).thenReturn(false);
        when(facilityRepository.save(any(ScenicFacility.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AdminScenicFacilityService service = new AdminScenicFacilityService(
                facilityRepository, categoryRepository, new ObjectMapper(), publicationService);

        service.updateFacility(12L, request());

        verify(publicationService).markOutdated(12L);
    }

    private ScenicFacilityRequestDto request() {
        ScenicFacilityRequestDto request = new ScenicFacilityRequestDto();
        request.setSpotCode(" LS-001 ");
        request.setName("灵山大佛");
        request.setCategoryId(3L);
        request.setLongitude(new BigDecimal("120.1010000"));
        request.setLatitude(new BigDecimal("31.4250000"));
        request.setShortDescription("世界最高露天青铜释迦牟尼立像");
        request.setLocationDescription("秦履峰南侧");
        request.setMapVisible(false);
        return request;
    }

    private FacilityCategory category() {
        FacilityCategory category = new FacilityCategory();
        category.setId(3L);
        category.setName("核心景点");
        return category;
    }
}
