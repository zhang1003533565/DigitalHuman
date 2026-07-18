package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicFacilityContentRequest;
import com.digitalhuman.backend_java.dto.ScenicFacilityContentResponse;
import com.digitalhuman.backend_java.dto.VisitorFacilityLiveConfigDto;
import com.digitalhuman.backend_java.model.ScenicFacility;
import com.digitalhuman.backend_java.model.ScenicFacilityDetail;
import com.digitalhuman.backend_java.model.ScenicFacilityPresentation;
import com.digitalhuman.backend_java.model.DigitalHumanModel;
import com.digitalhuman.backend_java.model.VoiceScriptScene;
import com.digitalhuman.backend_java.repository.DigitalHumanModelRepository;
import com.digitalhuman.backend_java.repository.ScenicFacilityDetailRepository;
import com.digitalhuman.backend_java.repository.ScenicFacilityPresentationRepository;
import com.digitalhuman.backend_java.repository.ScenicFacilityRepository;
import com.digitalhuman.backend_java.repository.VoiceScriptSceneRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;

class ScenicFacilityContentServiceTests {

    @Test
    void savesStructuredContentInIndependentColumnsForTheOfficialFacility() {
        Fixtures fixtures = fixtures();
        ScenicFacilityContentRequest request = contentRequest();

        ScenicFacilityContentResponse response = fixtures.service.saveContent(12L, request);

        assertEquals(12L, response.getFacilityId());
        assertEquals("佛教文化地标", response.getCoreFunction());
        assertEquals("体现佛教文化与铸造艺术", response.getCulturalConnotation());
        assertEquals("登云道远眺太湖", response.getHighlights());
        verify(fixtures.detailRepository).save(any(ScenicFacilityDetail.class));
        verify(fixtures.presentationRepository).save(any(ScenicFacilityPresentation.class));
    }

    @Test
    void rejectsAudioBindingWhenPublishedScriptBelongsToAnotherFacility() {
        Fixtures fixtures = fixtures();
        ScenicFacilityContentRequest request = contentRequest();
        request.setAudioEnabled(true);
        request.setBoundVoiceScriptId(33L);
        VoiceScriptScene script = new VoiceScriptScene();
        script.setFacilityId(99L);
        script.setStatus("published");
        script.setAudioStatus("ready");
        when(fixtures.voiceRepository.findById(33L)).thenReturn(Optional.of(script));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> fixtures.service.saveContent(12L, request));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertEquals("绑定口播不属于当前景点", error.getReason());
    }

    @Test
    void rejectsEnabledLiveWithoutTheSelectedSource() {
        Fixtures fixtures = fixtures();
        ScenicFacilityContentRequest request = contentRequest();
        request.setLiveEnabled(true);
        request.setLiveSourceType("video");

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> fixtures.service.saveContent(12L, request));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertEquals("开启直播后必须上传视频", error.getReason());
    }

    @Test
    void rejectsEnabledLiveWithoutADigitalHumanModel() {
        Fixtures fixtures = fixtures();
        ScenicFacilityContentRequest request = contentRequest();
        request.setLiveEnabled(true);
        request.setLiveSourceType("video");
        request.setLiveVideoUrl("/uploads/lingshan.mp4");

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> fixtures.service.saveContent(12L, request));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertEquals("开启直播后必须选择直播数字人", error.getReason());
    }

    @Test
    void savesTheSelectedActiveDigitalHumanForLiveBroadcast() {
        Fixtures fixtures = fixtures();
        DigitalHumanModel model = new DigitalHumanModel();
        model.setId(7L);
        model.setModelKey("hiyori_pro_zh");
        model.setDisplayName("Hiyori 中文模型");
        model.setModelPath("hiyori_pro_zh/hiyori_pro_t11.model3.json");
        model.setStatus("active");
        when(fixtures.modelRepository.findById(7L)).thenReturn(Optional.of(model));
        ScenicFacilityContentRequest request = contentRequest();
        request.setLiveEnabled(true);
        request.setLiveDigitalHumanModelId(7L);
        request.setLiveSourceType("video");
        request.setLiveVideoUrl("/uploads/lingshan.mp4");

        ScenicFacilityContentResponse response = fixtures.service.saveContent(12L, request);

        assertEquals(7L, response.getLiveDigitalHumanModelId());
        ArgumentCaptor<ScenicFacilityPresentation> captor = ArgumentCaptor.forClass(ScenicFacilityPresentation.class);
        verify(fixtures.presentationRepository).save(captor.capture());
        assertEquals(7L, captor.getValue().getLiveDigitalHumanModel().getId());
    }

    @Test
    void exposesTheBoundDigitalHumanToTheVisitorLivePage() {
        Fixtures fixtures = fixtures();
        DigitalHumanModel model = new DigitalHumanModel();
        model.setId(7L);
        model.setModelKey("hiyori_pro_zh");
        model.setDisplayName("Hiyori 中文模型");
        model.setModelPath("hiyori_pro_zh/hiyori_pro_t11.model3.json");
        model.setStatus("active");
        ScenicFacilityPresentation presentation = new ScenicFacilityPresentation();
        presentation.setLiveEnabled(true);
        presentation.setLiveSourceType("video");
        presentation.setLiveVideoUrl("/uploads/lingshan.mp4");
        presentation.setLiveDigitalHumanModel(model);
        when(fixtures.presentationRepository.findByFacilityId(12L)).thenReturn(Optional.of(presentation));

        VisitorFacilityLiveConfigDto result = fixtures.service.getVisitorLiveConfig(12L);

        assertEquals(true, result.available());
        assertEquals("hiyori_pro_zh", result.digitalHuman().modelKey());
        assertEquals("hiyori_pro_zh/hiyori_pro_t11.model3.json", result.digitalHuman().modelPath());
    }

    @Test
    void claimsLegacyPublishedScriptWhenItsSpotCodeMatchesTheOfficialFacility() {
        Fixtures fixtures = fixtures();
        ScenicFacilityContentRequest request = contentRequest();
        request.setAudioEnabled(true);
        request.setBoundVoiceScriptId(44L);
        VoiceScriptScene script = new VoiceScriptScene();
        script.setSpotId("LS-001");
        script.setStatus("published");
        script.setAudioStatus("ready");
        when(fixtures.voiceRepository.findById(44L)).thenReturn(Optional.of(script));

        fixtures.service.saveContent(12L, request);

        assertEquals(12L, script.getFacilityId());
        verify(fixtures.voiceRepository).save(script);
    }

    @Test
    void listsOnlyPublishedReadyScriptsForTheOfficialFacilityIncludingLegacyCodeMatches() {
        Fixtures fixtures = fixtures();
        VoiceScriptScene direct = voice(51L, 12L, "LS-001", "published", "ready");
        VoiceScriptScene legacy = voice(52L, null, "LS-001", "published", "ready");
        VoiceScriptScene stale = voice(53L, 12L, "LS-001", "published", "stale");
        when(fixtures.voiceRepository.findByFacilityIdAndStatusIgnoreCaseOrderByVersionNoDesc(12L, "published"))
                .thenReturn(List.of(direct, stale));
        when(fixtures.voiceRepository.findBySpotIdAndStatusIgnoreCaseOrderByVersionNoDesc("LS-001", "published"))
                .thenReturn(List.of(legacy));

        List<VoiceScriptScene> result = fixtures.service.listBindableVoiceScripts(12L);

        assertEquals(List.of(51L, 52L), result.stream().map(VoiceScriptScene::getId).toList());
    }

    @Test
    void listsAllFacilityVoiceScriptVersionsForManagementWithGlobalUpdatedAtSortingAndDeduplication() {
        Fixtures fixtures = fixtures();
        VoiceScriptScene olderDirect = voice(61L, 12L, "LS-001", "draft", "missing", LocalDateTime.of(2026, 7, 17, 9, 0));
        VoiceScriptScene duplicateDirect = voice(62L, 12L, "LS-001", "published", "ready", LocalDateTime.of(2026, 7, 17, 10, 0));
        VoiceScriptScene newerLegacy = voice(63L, null, "LS-001", "archived", "stale", LocalDateTime.of(2026, 7, 18, 8, 0));
        VoiceScriptScene duplicateLegacy = voice(62L, null, "LS-001", "published", "ready", LocalDateTime.of(2026, 7, 18, 7, 0));
        when(fixtures.voiceRepository.findByFacilityIdOrderByUpdatedAtDescIdDesc(12L))
                .thenReturn(List.of(duplicateDirect, olderDirect));
        when(fixtures.voiceRepository.findBySpotIdOrderByUpdatedAtDescIdDesc("LS-001"))
                .thenReturn(List.of(newerLegacy, duplicateLegacy));

        assertEquals(
                List.of(63L, 62L, 61L),
                fixtures.service.listVoiceScriptsForManagement(12L).stream().map(VoiceScriptScene::getId).toList());
    }

    private Fixtures fixtures() {
        ScenicFacilityRepository facilityRepository = mock(ScenicFacilityRepository.class);
        ScenicFacilityDetailRepository detailRepository = mock(ScenicFacilityDetailRepository.class);
        ScenicFacilityPresentationRepository presentationRepository = mock(ScenicFacilityPresentationRepository.class);
        VoiceScriptSceneRepository voiceRepository = mock(VoiceScriptSceneRepository.class);
        DigitalHumanModelRepository modelRepository = mock(DigitalHumanModelRepository.class);
        ScenicFacility facility = new ScenicFacility();
        facility.setId(12L);
        facility.setName("灵山大佛");
        facility.setSpotCode("LS-001");
        when(facilityRepository.findByIdAndDeletedAtIsNull(12L)).thenReturn(Optional.of(facility));
        when(detailRepository.findByFacilityId(12L)).thenReturn(Optional.empty());
        when(presentationRepository.findByFacilityId(12L)).thenReturn(Optional.empty());
        when(detailRepository.save(any(ScenicFacilityDetail.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(presentationRepository.save(any(ScenicFacilityPresentation.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ScenicFacilityContentService service = new ScenicFacilityContentService(
                facilityRepository, detailRepository, presentationRepository, voiceRepository, modelRepository);
        return new Fixtures(service, detailRepository, presentationRepository, voiceRepository, modelRepository);
    }

    private ScenicFacilityContentRequest contentRequest() {
        ScenicFacilityContentRequest request = new ScenicFacilityContentRequest();
        request.setArchitectureLandscapeParams("通高八十八米");
        request.setCoreFunction("佛教文化地标");
        request.setCulturalConnotation("体现佛教文化与铸造艺术");
        request.setDetailedIntroduction("灵山大佛是景区核心文化地标");
        request.setHighlights("登云道远眺太湖");
        request.setPerformanceOpenInfo("08:30-17:00");
        request.setVisitorNotes("请文明参观");
        request.setRemark("来源于结构化资料");
        request.setAudioEnabled(false);
        request.setLiveEnabled(false);
        return request;
    }

    private VoiceScriptScene voice(Long id, Long facilityId, String spotId, String status, String audioStatus) {
        return voice(id, facilityId, spotId, status, audioStatus, null);
    }

    private VoiceScriptScene voice(
            Long id,
            Long facilityId,
            String spotId,
            String status,
            String audioStatus,
            LocalDateTime updatedAt) {
        VoiceScriptScene scene = new VoiceScriptScene();
        scene.setId(id);
        scene.setFacilityId(facilityId);
        scene.setSpotId(spotId);
        scene.setStatus(status);
        scene.setAudioStatus(audioStatus);
        scene.setUpdatedAt(updatedAt);
        return scene;
    }

    private record Fixtures(
            ScenicFacilityContentService service,
            ScenicFacilityDetailRepository detailRepository,
            ScenicFacilityPresentationRepository presentationRepository,
            VoiceScriptSceneRepository voiceRepository,
            DigitalHumanModelRepository modelRepository) {
    }
}
