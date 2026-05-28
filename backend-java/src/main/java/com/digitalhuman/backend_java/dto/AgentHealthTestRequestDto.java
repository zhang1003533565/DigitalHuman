package com.digitalhuman.backend_java.dto;

public class AgentHealthTestRequestDto {

    private String agent;
    private String task;

    public String getAgent() {
        return agent;
    }

    public void setAgent(String agent) {
        this.agent = agent;
    }

    public String getTask() {
        return task;
    }

    public void setTask(String task) {
        this.task = task;
    }
}
