package com.digitalhuman.backend_java.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.digitalhuman.backend_java.dto.ActionMatchRequest;
import com.digitalhuman.backend_java.dto.ActionMatchResponse;
import com.digitalhuman.backend_java.dto.ActionTriggerConfigDto;
import com.digitalhuman.backend_java.dto.ActionTriggerRuleDto;
import com.digitalhuman.backend_java.model.DigitalHumanModel;
import com.digitalhuman.backend_java.model.ModelAction;
import com.digitalhuman.backend_java.repository.DigitalHumanModelRepository;
import com.digitalhuman.backend_java.repository.ModelActionRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class ModelEmotionServiceTests {

    @Autowired
    private ModelEmotionService service;

    @Autowired
    private DigitalHumanModelRepository modelRepository;

    @Autowired
    private ModelActionRepository actionRepository;

    @Test
    void saveTriggerConfigShouldRoundTripAndMatchRules() {
        DigitalHumanModel model = new DigitalHumanModel();
        model.setModelKey("test_model_" + System.nanoTime());
        model.setDisplayName("Test Model");
        model.setModelPath("test/test.model3.json");
        model.setStatus("active");
        model = modelRepository.save(model);

        ModelAction waveAction = saveAction(model, "wave", "Wave", 1);
        ModelAction nodAction = saveAction(model, "nod", "Nod", 2);

        ActionTriggerConfigDto request = new ActionTriggerConfigDto();
        request.setMouseRules(List.of(rule("MOUSE", "CLICK_LEFT", List.of(), waveAction.getId(), true, 0)));
        request.setTextRules(List.of(
                rule("KEYWORD", "", List.of("disabled"), nodAction.getId(), false, 0),
                rule("KEYWORD", "", List.of("hello", "thanks"), nodAction.getId(), true, 1)
        ));

        ActionTriggerConfigDto saved = service.saveTriggerConfig(model.getId(), request);

        assertThat(saved.getMouseRules()).hasSize(1);
        assertThat(saved.getTextRules()).hasSize(2);

        ActionMatchRequest mouseRequest = new ActionMatchRequest();
        mouseRequest.setModelKey(model.getModelKey());
        mouseRequest.setEventCode("CLICK_LEFT");
        ActionMatchResponse mouseMatch = service.matchAction(mouseRequest);
        assertThat(mouseMatch.isMatched()).isTrue();
        assertThat(mouseMatch.getActionId()).isEqualTo(waveAction.getId());

        ActionMatchRequest textRequest = new ActionMatchRequest();
        textRequest.setModelKey(model.getModelKey());
        textRequest.setText("hello visitor");
        ActionMatchResponse textMatch = service.matchAction(textRequest);
        assertThat(textMatch.isMatched()).isTrue();
        assertThat(textMatch.getActionId()).isEqualTo(nodAction.getId());

        ActionMatchRequest disabledRequest = new ActionMatchRequest();
        disabledRequest.setModelKey(model.getModelKey());
        disabledRequest.setText("disabled");
        assertThat(service.matchAction(disabledRequest).isMatched()).isFalse();
    }

    @Test
    void matchActionShouldRandomizeRulesWithSameHighestPriority() {
        DigitalHumanModel model = new DigitalHumanModel();
        model.setModelKey("random_model_" + System.nanoTime());
        model.setDisplayName("Random Model");
        model.setModelPath("test/random.model3.json");
        model.setStatus("active");
        model = modelRepository.save(model);

        ModelAction firstAction = saveAction(model, "first", "First", 1);
        ModelAction secondAction = saveAction(model, "second", "Second", 2);

        ActionTriggerConfigDto request = new ActionTriggerConfigDto();
        request.setMouseRules(List.of(
                rule("MOUSE", "CLICK_LEFT", List.of(), firstAction.getId(), true, 0),
                rule("MOUSE", "CLICK_LEFT", List.of(), secondAction.getId(), true, 0)
        ));
        service.saveTriggerConfig(model.getId(), request);

        ActionMatchRequest mouseRequest = new ActionMatchRequest();
        mouseRequest.setModelKey(model.getModelKey());
        mouseRequest.setEventCode("CLICK_LEFT");

        Set<Long> matchedActionIds = new HashSet<>();
        for (int index = 0; index < 100; index += 1) {
            matchedActionIds.add(service.matchAction(mouseRequest).getActionId());
        }

        assertThat(matchedActionIds).containsExactlyInAnyOrder(firstAction.getId(), secondAction.getId());
    }

    @Test
    void matchActionShouldAllowLowerPriorityRulesByWeight() {
        DigitalHumanModel model = new DigitalHumanModel();
        model.setModelKey("weighted_model_" + System.nanoTime());
        model.setDisplayName("Weighted Model");
        model.setModelPath("test/weighted.model3.json");
        model.setStatus("active");
        model = modelRepository.save(model);

        ModelAction highPriorityAction = saveAction(model, "high", "High", 1);
        ModelAction lowPriorityAction = saveAction(model, "low", "Low", 2);

        ActionTriggerConfigDto request = new ActionTriggerConfigDto();
        request.setMouseRules(List.of(
                rule("MOUSE", "CLICK_LEFT", List.of(), highPriorityAction.getId(), true, 1),
                rule("MOUSE", "CLICK_LEFT", List.of(), lowPriorityAction.getId(), true, 10)
        ));
        service.saveTriggerConfig(model.getId(), request);

        ActionMatchRequest mouseRequest = new ActionMatchRequest();
        mouseRequest.setModelKey(model.getModelKey());
        mouseRequest.setEventCode("CLICK_LEFT");

        Set<Long> matchedActionIds = new HashSet<>();
        for (int index = 0; index < 200; index += 1) {
            matchedActionIds.add(service.matchAction(mouseRequest).getActionId());
        }

        assertThat(matchedActionIds).contains(highPriorityAction.getId(), lowPriorityAction.getId());
    }

    private ModelAction saveAction(DigitalHumanModel model, String key, String name, int index) {
        ModelAction action = new ModelAction();
        action.setModel(model);
        action.setActionKey(key);
        action.setActionName(name);
        action.setGroupName("Action");
        action.setActionIndex(index);
        action.setMotionFilePath("motion/" + key + ".motion3.json");
        action.setEnabled(true);
        return actionRepository.save(action);
    }

    private ActionTriggerRuleDto rule(
            String ruleType,
            String eventCode,
            List<String> phrases,
            Long actionId,
            boolean enabled,
            int priority) {
        ActionTriggerRuleDto dto = new ActionTriggerRuleDto();
        dto.setRuleType(ruleType);
        dto.setEventCode(eventCode);
        dto.setPhrases(phrases);
        dto.setActionId(actionId);
        dto.setEnabled(enabled);
        dto.setPriority(priority);
        return dto;
    }
}
