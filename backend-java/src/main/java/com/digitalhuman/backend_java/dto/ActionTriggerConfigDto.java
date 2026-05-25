package com.digitalhuman.backend_java.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ActionTriggerConfigDto {
    private Map<String, Object> model;
    private List<Map<String, Object>> actions = new ArrayList<>();
    private List<ActionTriggerRuleDto> mouseRules = new ArrayList<>();
    private List<ActionTriggerRuleDto> textRules = new ArrayList<>();

    public Map<String, Object> getModel() {
        return model;
    }

    public void setModel(Map<String, Object> model) {
        this.model = model;
    }

    public List<Map<String, Object>> getActions() {
        return actions;
    }

    public void setActions(List<Map<String, Object>> actions) {
        this.actions = actions == null ? new ArrayList<>() : actions;
    }

    public List<ActionTriggerRuleDto> getMouseRules() {
        return mouseRules;
    }

    public void setMouseRules(List<ActionTriggerRuleDto> mouseRules) {
        this.mouseRules = mouseRules == null ? new ArrayList<>() : mouseRules;
    }

    public List<ActionTriggerRuleDto> getTextRules() {
        return textRules;
    }

    public void setTextRules(List<ActionTriggerRuleDto> textRules) {
        this.textRules = textRules == null ? new ArrayList<>() : textRules;
    }
}
