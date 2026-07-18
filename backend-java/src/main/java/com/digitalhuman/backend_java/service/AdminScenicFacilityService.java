package com.digitalhuman.backend_java.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.digitalhuman.backend_java.dto.FacilityCategoryDto;
import com.digitalhuman.backend_java.dto.FacilityCategoryRequestDto;
import com.digitalhuman.backend_java.dto.ScenicFacilityDto;
import com.digitalhuman.backend_java.dto.ScenicFacilityRequestDto;
import com.digitalhuman.backend_java.model.FacilityCategory;
import com.digitalhuman.backend_java.model.ScenicFacility;
import com.digitalhuman.backend_java.repository.FacilityCategoryRepository;
import com.digitalhuman.backend_java.repository.ScenicFacilityRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

@Service
public class AdminScenicFacilityService {

    private final ScenicFacilityRepository scenicFacilityRepository;
    private final FacilityCategoryRepository facilityCategoryRepository;
    private final ObjectMapper objectMapper;

    public AdminScenicFacilityService(
            ScenicFacilityRepository scenicFacilityRepository,
            FacilityCategoryRepository facilityCategoryRepository,
            ObjectMapper objectMapper) {
        this.scenicFacilityRepository = scenicFacilityRepository;
        this.facilityCategoryRepository = facilityCategoryRepository;
        this.objectMapper = objectMapper;
    }

    public List<ScenicFacilityDto> getFacilities() {
        return scenicFacilityRepository.findAllByDeletedAtIsNullOrderByUpdatedAtDescIdDesc().stream()
                .map(this::toFacilityDto)
                .toList();
    }

    public List<ScenicFacilityDto> getMapVisibleFacilities() {
        return scenicFacilityRepository.findMapVisibleFacilities().stream()
                .map(this::toFacilityDto)
                .toList();
    }

    public ScenicFacilityDto getFacility(Long id) {
        return toFacilityDto(findFacility(id));
    }

    @Transactional
    public ScenicFacilityDto createFacility(ScenicFacilityRequestDto request) {
        ScenicFacility facility = new ScenicFacility();
        applyFacilityRequest(facility, request, null);
        return toFacilityDto(scenicFacilityRepository.save(facility));
    }

    @Transactional
    public ScenicFacilityDto updateFacility(Long id, ScenicFacilityRequestDto request) {
        ScenicFacility facility = findFacility(id);
        applyFacilityRequest(facility, request, id);
        return toFacilityDto(scenicFacilityRepository.save(facility));
    }

    @Transactional
    public void deleteFacility(Long id) {
        ScenicFacility facility = findFacility(id);
        facility.setDeletedAt(LocalDateTime.now());
        scenicFacilityRepository.save(facility);
    }

    public List<FacilityCategoryDto> getCategories() {
        return facilityCategoryRepository.findAllByDeletedAtIsNullOrderBySortOrderAscIdAsc().stream()
                .map(this::toCategoryDto)
                .toList();
    }

    public List<FacilityCategoryDto> getMapVisibleCategories() {
        return facilityCategoryRepository.findMapVisibleCategories().stream()
                .map(this::toCategoryDto)
                .toList();
    }

    @Transactional
    public FacilityCategoryDto createCategory(FacilityCategoryRequestDto request) {
        String name = normalizeRequiredText(request.getName(), "Category name must not be blank");
        if (facilityCategoryRepository.existsByNameIgnoreCaseAndDeletedAtIsNull(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Category name already exists");
        }

        FacilityCategory category = new FacilityCategory();
        category.setName(name);
        category.setSortOrder(normalizeSortOrder(request.getSortOrder()));
        category.setMapVisible(normalizeMapVisible(request.getMapVisible()));
        return toCategoryDto(facilityCategoryRepository.save(category));
    }

    @Transactional
    public FacilityCategoryDto updateCategory(Long id, FacilityCategoryRequestDto request) {
        FacilityCategory category = findCategory(id);
        String name = normalizeRequiredText(request.getName(), "Category name must not be blank");
        if (facilityCategoryRepository.existsByNameIgnoreCaseAndDeletedAtIsNullAndIdNot(name, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Category name already exists");
        }

        category.setName(name);
        category.setSortOrder(normalizeSortOrder(request.getSortOrder()));
        category.setMapVisible(normalizeMapVisible(request.getMapVisible()));
        return toCategoryDto(facilityCategoryRepository.save(category));
    }

    @Transactional
    public void deleteCategory(Long id) {
        FacilityCategory category = findCategory(id);
        if (scenicFacilityRepository.existsByCategory_IdAndDeletedAtIsNull(id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category still has facilities and cannot be deleted");
        }
        category.setDeletedAt(LocalDateTime.now());
        facilityCategoryRepository.save(category);
    }

    private void applyFacilityRequest(ScenicFacility facility, ScenicFacilityRequestDto request, Long currentId) {
        String name = normalizeRequiredText(request.getName(), "Facility name must not be blank");
        FacilityCategory category = findCategory(request.getCategoryId());
        String spotCode = normalizeOptionalText(request.getSpotCode());
        boolean duplicateCode = spotCode != null && (currentId == null
                ? scenicFacilityRepository.existsBySpotCodeIgnoreCaseAndDeletedAtIsNull(spotCode)
                : scenicFacilityRepository.existsBySpotCodeIgnoreCaseAndDeletedAtIsNullAndIdNot(spotCode, currentId));
        if (duplicateCode) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "景点编码已存在");
        }

        facility.setSpotCode(spotCode);
        facility.setName(name);
        facility.setShortDescription(normalizeOptionalText(request.getShortDescription()));
        facility.setLocationDescription(normalizeOptionalText(request.getLocationDescription()));
        facility.setCategory(category);
        facility.setLongitude(request.getLongitude());
        facility.setLatitude(request.getLatitude());
        facility.setImage(normalizeOptionalText(request.getImage()));
        facility.setGalleryImages(writeGalleryImages(request.getGalleryImages()));
        facility.setOpenTime(request.getOpenTime());
        facility.setCloseTime(request.getCloseTime());
        facility.setMapVisible(request.getMapVisible() == null || request.getMapVisible());
    }

    private ScenicFacility findFacility(Long id) {
        return scenicFacilityRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Facility not found"));
    }

    private FacilityCategory findCategory(Long id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category is required");
        }
        return facilityCategoryRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category not found"));
    }

    private ScenicFacilityDto toFacilityDto(ScenicFacility facility) {
        return new ScenicFacilityDto(
                facility.getId(),
                facility.getSpotCode(),
                facility.getName(),
                facility.getShortDescription(),
                facility.getLocationDescription(),
                facility.getCategory().getId(),
                facility.getCategory().getName(),
                facility.getLongitude(),
                facility.getLatitude(),
                facility.getImage(),
                readGalleryImages(facility.getGalleryImages()),
                facility.getOpenTime(),
                facility.getCloseTime(),
                facility.getMapVisible() == null || facility.getMapVisible(),
                facility.getCreatedAt(),
                facility.getUpdatedAt());
    }

    private FacilityCategoryDto toCategoryDto(FacilityCategory category) {
        return new FacilityCategoryDto(
                category.getId(),
                category.getName(),
                category.getSortOrder(),
                normalizeMapVisible(category.getMapVisible()));
    }

    private String normalizeRequiredText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Integer normalizeSortOrder(Integer sortOrder) {
        return sortOrder == null ? 0 : sortOrder;
    }

    private Boolean normalizeMapVisible(Boolean mapVisible) {
        return mapVisible == null || mapVisible;
    }

    private String writeGalleryImages(List<String> galleryImages) {
        List<String> normalized = galleryImages == null
                ? List.of()
                : galleryImages.stream()
                .map(this::normalizeOptionalText)
                .filter(value -> value != null)
                .toList();
        try {
            return objectMapper.writeValueAsString(normalized);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Gallery images format is invalid");
        }
    }

    private List<String> readGalleryImages(String galleryImagesJson) {
        if (galleryImagesJson == null || galleryImagesJson.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(galleryImagesJson, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException exception) {
            return Collections.emptyList();
        }
    }
}
