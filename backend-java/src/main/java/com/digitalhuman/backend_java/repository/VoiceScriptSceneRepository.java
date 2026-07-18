package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.VoiceScriptScene;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VoiceScriptSceneRepository extends JpaRepository<VoiceScriptScene, Long> {

    List<VoiceScriptScene> findAllByOrderByUpdatedAtDescIdDesc();

    Optional<VoiceScriptScene> findBySpotIdAndSceneTypeAndStyleAndVersionNo(String spotId, String sceneType, String style, Integer versionNo);

    Optional<VoiceScriptScene> findBySpotIdAndSceneTypeAndStyleAndVersionNoAndIdNot(
            String spotId,
            String sceneType,
            String style,
            Integer versionNo,
            Long id
    );

    List<VoiceScriptScene> findBySpotIdAndSceneTypeAndStyleAndStatusIgnoreCase(String spotId, String sceneType, String style, String status);

    Optional<VoiceScriptScene> findTopBySpotIdAndSceneTypeAndStyleOrderByVersionNoDesc(
            String spotId,
            String sceneType,
            String style
    );

    List<VoiceScriptScene> findBySpotIdAndStatusIgnoreCaseOrderByVersionNoDesc(String spotId, String status);
}
