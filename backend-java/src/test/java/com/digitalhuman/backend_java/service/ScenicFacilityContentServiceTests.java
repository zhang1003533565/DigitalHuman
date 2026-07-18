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
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    private Fixtures fixtures() {
        ScenicFacilityRepository facilityRepository = mock(ScenicFacilityRepository.class);
        ScenicFacilityDetailRepository detailRepository = mock(ScenicFacilityDetailRepository.class);
        ScenicFacilityPresentationRepository presentationRepository = mock(ScenicFacilityPresentationRepository.class);
        VoiceScriptSceneRepository voiceRepository = mock(VoiceScriptSceneRepository.class);
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
                facilityRepository, detailRepository, presentationRepository, voiceRepository);
        return new Fixtures(service, detailRepository, presentationRepository, voiceRepository);
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
        VoiceScriptScene scene = new VoiceScriptScene();
        scene.setId(id);
        scene.setFacilityId(facilityId);
        scene.setSpotId(spotId);
        scene.setStatus(status);
        scene.setAudioStatus(audioStatus);
        return scene;
    }

    private record Fixtures(
            ScenicFacilityContentService service,
            ScenicFacilityDetailRepository detailRepository,
            ScenicFacilityPresentationRepository presentationRepository,
            VoiceScriptSceneRepository voiceRepository) {
    }
}
