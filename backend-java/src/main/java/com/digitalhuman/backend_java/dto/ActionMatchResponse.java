package com.digitalhuman.backend_java.dto;

public class ActionMatchResponse {
    private boolean matched;
    private Long actionId;
    private String actionName;
    private String motionFilePath;
    private String groupName;
    private Integer actionIndex;
    private String ruleType;
    private String eventCode;

    public static ActionMatchResponse empty() {
        return new ActionMatchResponse();
    }

    public boolean isMatched() {
        return matched;
    }

    public void setMatched(boolean matched) {
        this.matched = matched;
    }

    public Long getActionId() {
        return actionId;
    }

    public void setActionId(Long actionId) {
        this.actionId = actionId;
    }

    public String getActionName() {
        return actionName;
    }

    public void setActionName(String actionName) {
        this.actionName = actionName;
    }

    public String getMotionFilePath() {
        return motionFilePath;
    }

    public void setMotionFilePath(String motionFilePath) {
        this.motionFilePath = motionFilePath;
    }

    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String groupName) {
        this.groupName = groupName;
    }

    public Integer getActionIndex() {
        return actionIndex;
    }

    public void setActionIndex(Integer actionIndex) {
        this.actionIndex = actionIndex;
    }

    public String getRuleType() {
        return ruleType;
    }

    public void setRuleType(String ruleType) {
        this.ruleType = ruleType;
    }

    public String getEventCode() {
        return eventCode;
    }

    public void setEventCode(String eventCode) {
        this.eventCode = eventCode;
    }
}
