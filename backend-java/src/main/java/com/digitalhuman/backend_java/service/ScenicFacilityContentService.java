package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicFacilityContentRequest;
import com.digitalhuman.backend_java.dto.ScenicFacilityContentResponse;
import com.digitalhuman.backend_java.model.ScenicFacility;
import com.digitalhuman.backend_java.model.ScenicFacilityDetail;
import com.digitalhuman.backend_java.model.ScenicFacilityPresentation;
import com.digitalhuman.backend_java.model.VoiceScriptScene;
import com.digitalhuman.backend_java.repository.ScenicFacilityDetailRepository;
import com.digitalhuman.backend_java.repository.ScenicFacilityPresentationRepository;
import com.digitalhuman.backend_java.repository.ScenicFacilityRepository;
import com.digitalhuman.backend_java.repository.VoiceScriptSceneRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ScenicFacilityContentService {
    private final ScenicFacilityRepository facilityRepository;
    private final ScenicFacilityDetailRepository detailRepository;
    private final ScenicFacilityPresentationRepository presentationRepository;
    private final VoiceScriptSceneRepository voiceScriptRepository;
    private final ScenicKnowledgePublicationService publicationService;

    public ScenicFacilityContentService(
            ScenicFacilityRepository facilityRepository,
            ScenicFacilityDetailRepository detailRepository,
            ScenicFacilityPresentationRepository presentationRepository,
            VoiceScriptSceneRepository voiceScriptRepository,
            ScenicKnowledgePublicationService publicationService) {
        this.facilityRepository = facilityRepository;
        this.detailRepository = detailRepository;
        this.presentationRepository = presentationRepository;
        this.voiceScriptRepository = voiceScriptRepository;
        this.publicationService = publicationService;
    }

    public ScenicFacilityContentResponse getContent(Long facilityId) {
        ScenicFacility facility = findFacility(facilityId);
        ScenicFacilityDetail detail = detailRepository.findByFacilityId(facilityId).orElse(null);
        ScenicFacilityPresentation presentation = presentationRepository.findByFacilityId(facilityId).orElse(null);
        return toResponse(facility, detail, presentation);
    }

    public List<VoiceScriptScene> listBindableVoiceScripts(Long facilityId) {
        ScenicFacility facility = findFacility(facilityId);
        Map<Long, VoiceScriptScene> rows = new LinkedHashMap<>();
        voiceScriptRepository.findByFacilityIdAndStatusIgnoreCaseOrderByVersionNoDesc(facilityId, "published")
                .stream()
                .filter(scene -> "ready".equalsIgnoreCase(clean(scene.getAudioStatus())))
                .forEach(scene -> rows.put(scene.getId(), scene));
        if (clean(facility.getSpotCode()) != null) {
            voiceScriptRepository.findBySpotIdAndStatusIgnoreCaseOrderByVersionNoDesc(facility.getSpotCode(), "published")
                    .stream()
                    .filter(scene -> "ready".equalsIgnoreCase(clean(scene.getAudioStatus())))
                    .forEach(scene -> rows.putIfAbsent(scene.getId(), scene));
        }
        return List.copyOf(rows.values());
    }

    @Transactional
    public ScenicFacilityContentResponse saveContent(Long facilityId, ScenicFacilityContentRequest request) {
        ScenicFacility facility = findFacility(facilityId);
        validatePresentation(facility, request);
        ScenicFacilityDetail detail = detailRepository.findByFacilityId(facilityId).orElseGet(() -> {
            ScenicFacilityDetail created = new ScenicFacilityDetail();
            created.setFacility(facility);
            created.setContentVersion(0);
            return created;
        });
        detail.setArchitectureLandscapeParams(clean(request.getArchitectureLandscapeParams()));
        detail.setCoreFunction(clean(request.getCoreFunction()));
        detail.setCulturalConnotation(clean(request.getCulturalConnotation()));
        detail.setDetailedIntroduction(clean(request.getDetailedIntroduction()));
        detail.setHighlights(clean(request.getHighlights()));
        detail.setPerformanceOpenInfo(clean(request.getPerformanceOpenInfo()));
        detail.setVisitorNotes(clean(request.getVisitorNotes()));
        detail.setRemark(clean(request.getRemark()));
        detail.setSourceRecordId(request.getSourceRecordId());
        detail.setContentVersion(detail.getContentVersion() == null ? 1 : detail.getContentVersion() + 1);

        ScenicFacilityPresentation presentation = presentationRepository.findByFacilityId(facilityId).orElseGet(() -> {
            ScenicFacilityPresentation created = new ScenicFacilityPresentation();
            created.setFacility(facility);
            return created;
        });
        applyPresentation(presentation, request);
        detailRepository.save(detail);
        presentationRepository.save(presentation);
        publicationService.markOutdated(facilityId);
        return toResponse(facility, detail, presentation);
    }

    private void validatePresentation(ScenicFacility facility, ScenicFacilityContentRequest request) {
        Long facilityId = facility.getId();
        boolean audioEnabled = Boolean.TRUE.equals(request.getAudioEnabled());
        boolean liveEnabled = Boolean.TRUE.equals(request.getLiveEnabled());
        if (audioEnabled) {
            if (request.getBoundVoiceScriptId() == null) {
                badRequest("开启语音后必须绑定口播");
            }
            VoiceScriptScene script = voiceScriptRepository.findById(request.getBoundVoiceScriptId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "绑定口播不存在"));
            if (script.getFacilityId() == null
                    && clean(facility.getSpotCode()) != null
                    && facility.getSpotCode().equalsIgnoreCase(clean(script.getSpotId()))) {
                script.setFacilityId(facilityId);
                voiceScriptRepository.save(script);
            }
            if (!facilityId.equals(script.getFacilityId())) {
                badRequest("绑定口播不属于当前景点");
            }
            if (!"published".equalsIgnoreCase(script.getStatus()) || !"ready".equalsIgnoreCase(script.getAudioStatus())) {
                badRequest("只能绑定已发布且音频可用的口播");
            }
        }
        if (liveEnabled) {
            String sourceType = clean(request.getLiveSourceType());
            if ("video".equals(sourceType) && clean(request.getLiveVideoUrl()) == null) badRequest("开启直播后必须上传视频");
            if ("stream".equals(sourceType) && clean(request.getLiveStreamUrl()) == null) badRequest("开启直播后必须填写直播流地址");
            if ("camera".equals(sourceType) && clean(request.getCameraStreamKey()) == null) badRequest("开启直播后必须配置摄像头通道");
            if (!"video".equals(sourceType) && !"stream".equals(sourceType) && !"camera".equals(sourceType)) badRequest("开启直播后必须选择直播来源");
        }
        String defaultExperience = clean(request.getDefaultExperience());
        if (defaultExperience != null
                && (!("audio".equals(defaultExperience) && audioEnabled) && !("live".equals(defaultExperience) && liveEnabled))) {
            badRequest("默认体验必须是已开启的语音或直播");
        }
    }

    private void applyPresentation(ScenicFacilityPresentation target, ScenicFacilityContentRequest source) {
        boolean audio = Boolean.TRUE.equals(source.getAudioEnabled());
        boolean live = Boolean.TRUE.equals(source.getLiveEnabled());
        target.setAudioEnabled(audio);
        target.setBoundVoiceScriptId(audio ? source.getBoundVoiceScriptId() : null);
        target.setLiveEnabled(live);
        target.setDefaultExperience(audio || live ? clean(source.getDefaultExperience()) : null);
        target.setLiveSourceType(live ? clean(source.getLiveSourceType()) : null);
        target.setLiveVideoUrl(live && "video".equals(source.getLiveSourceType()) ? clean(source.getLiveVideoUrl()) : null);
        target.setLiveStreamUrl(live && "stream".equals(source.getLiveSourceType()) ? clean(source.getLiveStreamUrl()) : null);
        target.setCameraStreamKey(live && "camera".equals(source.getLiveSourceType()) ? clean(source.getCameraStreamKey()) : null);
    }

    private ScenicFacilityContentResponse toResponse(ScenicFacility facility, ScenicFacilityDetail detail, ScenicFacilityPresentation presentation) {
        ScenicFacilityContentResponse response = new ScenicFacilityContentResponse();
        response.setFacilityId(facility.getId());
        if (detail != null) {
            response.setArchitectureLandscapeParams(detail.getArchitectureLandscapeParams());
            response.setCoreFunction(detail.getCoreFunction());
            response.setCulturalConnotation(detail.getCulturalConnotation());
            response.setDetailedIntroduction(detail.getDetailedIntroduction());
            response.setHighlights(detail.getHighlights());
            response.setPerformanceOpenInfo(detail.getPerformanceOpenInfo());
            response.setVisitorNotes(detail.getVisitorNotes());
            response.setRemark(detail.getRemark());
            response.setSourceRecordId(detail.getSourceRecordId());
            response.setContentVersion(detail.getContentVersion());
        }
        if (presentation != null) {
            response.setAudioEnabled(presentation.getAudioEnabled());
            response.setLiveEnabled(presentation.getLiveEnabled());
            response.setDefaultExperience(presentation.getDefaultExperience());
            response.setBoundVoiceScriptId(presentation.getBoundVoiceScriptId());
            response.setLiveSourceType(presentation.getLiveSourceType());
            response.setLiveVideoUrl(presentation.getLiveVideoUrl());
            response.setLiveStreamUrl(presentation.getLiveStreamUrl());
            response.setCameraStreamKey(presentation.getCameraStreamKey());
        }
        return response;
    }

    private ScenicFacility findFacility(Long id) {
        return facilityRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Facility not found"));
    }

    private String clean(String value) { if (value == null) return null; String text = value.trim(); return text.isEmpty() ? null : text; }
    private void badRequest(String message) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
