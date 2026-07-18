package com.digitalhuman.backend_java.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class VoiceScriptSceneRequestValidationTests {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void acceptsShortManualScriptWhenAllOtherFieldsAreValid() {
        VoiceScriptSceneRequest request = new VoiceScriptSceneRequest();
        request.setScenicName("灵山胜境");
        request.setSpotId("LS-001");
        request.setSpotName("灵山大佛");
        request.setSceneType("spot");
        request.setStyle("culture");
        request.setTitle("简短提醒");
        request.setScriptText("前方台阶较多，请慢行。");
        request.setDurationSec(20);
        request.setVersionNo(1);
        request.setStatus("draft");

        assertTrue(validator.validate(request).isEmpty());
    }
}
