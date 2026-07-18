package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicStructuredImportResult;
import com.digitalhuman.backend_java.dto.ScenicStructuredSpotRecordRequest;
import com.digitalhuman.backend_java.model.ScenicStructuredSpotRecord;
import com.digitalhuman.backend_java.model.VoiceScriptScene;
import com.digitalhuman.backend_java.repository.ScenicStructuredSpotRecordRepository;
import com.digitalhuman.backend_java.repository.VoiceScriptSceneRepository;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ScenicStructuredSpotServiceTests {

    private static final List<String> HEADERS = List.of(
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

    @Test
    void importFromDocxImportsEveryMatchingTable() throws Exception {
        ScenicStructuredSpotRecordRepository repository = mock(ScenicStructuredSpotRecordRepository.class);
        VoiceScriptSceneRepository voiceScriptRepository = mock(VoiceScriptSceneRepository.class);
        when(repository.saveAll(org.mockito.ArgumentMatchers.anyList())).thenAnswer(invocation -> invocation.getArgument(0));
        ScenicStructuredSpotService service = new ScenicStructuredSpotService(repository, voiceScriptRepository);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "scenic.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                docxWithTwoStructuredTables()
        );

        ScenicStructuredImportResult result = service.importFromDocx(file, true);

        assertEquals(3, result.getImportedCount());
        assertEquals(0, result.getSkippedEmptyCount());
        assertEquals(0, result.getSkippedDuplicateCount());
        assertEquals(0, result.getIssues().size());
        verify(repository).deleteAllInBatch();
        ArgumentCaptor<List<ScenicStructuredSpotRecord>> rows = ArgumentCaptor.forClass(List.class);
        verify(repository).saveAll(rows.capture());
        assertEquals(List.of("LS-001", "LS-002", "NH-001"), rows.getValue().stream().map(ScenicStructuredSpotRecord::getSpot_id).toList());
        rows.getValue().forEach(row -> {
            assertFalse(row.getAudio_enabled());
            assertFalse(row.getLive_enabled());
            assertNull(row.getDefault_experience());
            assertNull(row.getBound_voice_script_id());
        });
    }

    @Test
    void createRecordRejectsAudioWithoutBoundVoiceScript() {
        ScenicStructuredSpotRecordRepository repository = repositoryWithoutDuplicate();
        ScenicStructuredSpotRecordRequest request = baseRequest();
        request.setAudio_enabled(true);

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service(repository, mock(VoiceScriptSceneRepository.class)).createRecord(request)
        );

        assertBadRequest(error, "启用语音时必须绑定口播");
    }

    @Test
    void createRecordRejectsUnpublishedBoundVoiceScript() {
        ScenicStructuredSpotRecordRepository repository = repositoryWithoutDuplicate();
        VoiceScriptSceneRepository voiceScriptRepository = mock(VoiceScriptSceneRepository.class);
        ScenicStructuredSpotRecordRequest request = audioRequest(11L);
        when(voiceScriptRepository.findById(11L)).thenReturn(Optional.of(voiceScript("LS-001", "draft", "ready")));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service(repository, voiceScriptRepository).createRecord(request)
        );

        assertBadRequest(error, "只能绑定已发布的口播");
    }

    @Test
    void createRecordRejectsBoundVoiceScriptWithoutReadyAudio() {
        ScenicStructuredSpotRecordRepository repository = repositoryWithoutDuplicate();
        VoiceScriptSceneRepository voiceScriptRepository = mock(VoiceScriptSceneRepository.class);
        ScenicStructuredSpotRecordRequest request = audioRequest(12L);
        when(voiceScriptRepository.findById(12L)).thenReturn(Optional.of(voiceScript("LS-001", "published", "stale")));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service(repository, voiceScriptRepository).createRecord(request)
        );

        assertBadRequest(error, "只能绑定音频已就绪的口播");
    }

    @Test
    void createRecordAcceptsPublishedVoiceScriptWithReadyAudio() {
        ScenicStructuredSpotRecordRepository repository = repositoryWithoutDuplicate();
        VoiceScriptSceneRepository voiceScriptRepository = mock(VoiceScriptSceneRepository.class);
        ScenicStructuredSpotRecordRequest request = audioRequest(13L);
        when(voiceScriptRepository.findById(13L)).thenReturn(Optional.of(voiceScript("LS-001", "published", "ready")));

        service(repository, voiceScriptRepository).createRecord(request);

        ArgumentCaptor<ScenicStructuredSpotRecord> saved = ArgumentCaptor.forClass(ScenicStructuredSpotRecord.class);
        verify(repository).save(saved.capture());
        assertEquals(true, saved.getValue().getAudio_enabled());
        assertEquals(13L, saved.getValue().getBound_voice_script_id());
        assertEquals("audio", saved.getValue().getDefault_experience());
    }

    @Test
    void createRecordRejectsVoiceScriptBelongingToAnotherSpot() {
        ScenicStructuredSpotRecordRepository repository = repositoryWithoutDuplicate();
        VoiceScriptSceneRepository voiceScriptRepository = mock(VoiceScriptSceneRepository.class);
        ScenicStructuredSpotRecordRequest request = audioRequest(15L);
        when(voiceScriptRepository.findById(15L)).thenReturn(Optional.of(voiceScript("LS-002", "published", "ready")));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service(repository, voiceScriptRepository).createRecord(request)
        );

        assertBadRequest(error, "绑定口播必须属于当前景点");
    }

    @Test
    void createRecordRejectsLiveWithoutSource() {
        ScenicStructuredSpotRecordRepository repository = repositoryWithoutDuplicate();
        ScenicStructuredSpotRecordRequest request = baseRequest();
        request.setLive_enabled(true);
        request.setLive_source_type("video");

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service(repository, mock(VoiceScriptSceneRepository.class)).createRecord(request)
        );

        assertBadRequest(error, "视频直播必须配置视频地址");
    }

    @Test
    void createRecordAcceptsEachCompleteLiveSourceType() {
        List<ScenicStructuredSpotRecordRequest> requests = List.of(
                liveRequest("video", "/media/tour.mp4", null, null),
                liveRequest("stream", null, "https://live.example/spot.m3u8", null),
                liveRequest("camera", null, null, "camera-channel-1")
        );

        for (ScenicStructuredSpotRecordRequest request : requests) {
            ScenicStructuredSpotRecordRepository repository = repositoryWithoutDuplicate();
            when(repository.save(org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> invocation.getArgument(0));

            ScenicStructuredSpotRecord saved = service(repository, mock(VoiceScriptSceneRepository.class)).createRecord(request);

            assertEquals(true, saved.getLive_enabled());
            assertEquals("live", saved.getDefault_experience());
            assertEquals(request.getLive_source_type(), saved.getLive_source_type());
        }
    }

    @Test
    void createRecordRejectsInvalidDefaultWhenAudioAndLiveAreEnabled() {
        ScenicStructuredSpotRecordRepository repository = repositoryWithoutDuplicate();
        VoiceScriptSceneRepository voiceScriptRepository = mock(VoiceScriptSceneRepository.class);
        ScenicStructuredSpotRecordRequest request = audioRequest(14L);
        request.setLive_enabled(true);
        request.setLive_source_type("stream");
        request.setLive_stream_url("https://live.example/spot.m3u8");
        request.setDefault_experience("panorama");
        when(voiceScriptRepository.findById(14L)).thenReturn(Optional.of(voiceScript("LS-001", "published", "ready")));

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service(repository, voiceScriptRepository).createRecord(request)
        );

        assertBadRequest(error, "同时启用语音和直播时，默认入口必须为 audio 或 live");
    }

    private ScenicStructuredSpotService service(
            ScenicStructuredSpotRecordRepository repository,
            VoiceScriptSceneRepository voiceScriptRepository
    ) {
        return new ScenicStructuredSpotService(repository, voiceScriptRepository);
    }

    private ScenicStructuredSpotRecordRepository repositoryWithoutDuplicate() {
        ScenicStructuredSpotRecordRepository repository = mock(ScenicStructuredSpotRecordRepository.class);
        when(repository.findBySpot_idIgnoreCase("LS-001")).thenReturn(Optional.empty());
        when(repository.save(org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> invocation.getArgument(0));
        return repository;
    }

    private ScenicStructuredSpotRecordRequest baseRequest() {
        ScenicStructuredSpotRecordRequest request = new ScenicStructuredSpotRecordRequest();
        request.setScenic_name("灵山胜境");
        request.setSpot_id("LS-001");
        request.setSpot_name("灵山大照壁");
        return request;
    }

    private ScenicStructuredSpotRecordRequest audioRequest(Long voiceScriptId) {
        ScenicStructuredSpotRecordRequest request = baseRequest();
        request.setAudio_enabled(true);
        request.setBound_voice_script_id(voiceScriptId);
        request.setDefault_experience("audio");
        return request;
    }

    private ScenicStructuredSpotRecordRequest liveRequest(
            String sourceType,
            String videoUrl,
            String streamUrl,
            String cameraStreamKey
    ) {
        ScenicStructuredSpotRecordRequest request = baseRequest();
        request.setLive_enabled(true);
        request.setDefault_experience("live");
        request.setLive_source_type(sourceType);
        request.setLive_video_url(videoUrl);
        request.setLive_stream_url(streamUrl);
        request.setCamera_stream_key(cameraStreamKey);
        return request;
    }

    private VoiceScriptScene voiceScript(String spotId, String status, String audioStatus) {
        VoiceScriptScene scene = new VoiceScriptScene();
        scene.setSpotId(spotId);
        scene.setStatus(status);
        scene.setAudioStatus(audioStatus);
        return scene;
    }

    private void assertBadRequest(ResponseStatusException error, String reason) {
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertEquals(reason, error.getReason());
    }

    private byte[] docxWithTwoStructuredTables() throws Exception {
        try (XWPFDocument document = new XWPFDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            document.createParagraph().createRun().setText("灵山胜境 景点结构化数据集");
            appendTable(document, List.of(
                    row("灵山胜境", "LS-001", "灵山大照壁"),
                    row("灵山胜境", "LS-002", "五明桥")
            ));
            document.createParagraph().createRun().setText("表2：拈花湾禅意小镇 景点数据集");
            appendTable(document, List.of(
                    row("拈花湾禅意小镇", "NH-001", "拈花广场")
            ));
            document.write(output);
            return output.toByteArray();
        }
    }

    private void appendTable(XWPFDocument document, List<List<String>> rows) {
        XWPFTable table = document.createTable(1, HEADERS.size());
        for (int index = 0; index < HEADERS.size(); index++) {
            table.getRow(0).getCell(index).setText(HEADERS.get(index));
        }
        for (List<String> row : rows) {
            var tableRow = table.createRow();
            for (int index = 0; index < row.size(); index++) {
                tableRow.getCell(index).setText(row.get(index));
            }
        }
    }

    private List<String> row(String scenicName, String spotId, String spotName) {
        return List.of(
                scenicName,
                spotId,
                spotName,
                "具体位置",
                "建筑/景观参数",
                "核心功能",
                "文化内涵",
                "详细介绍",
                "游玩亮点",
                "演艺/开放信息",
                "备注"
        );
    }
}
