package com.digitalhuman.backend_java.dto;

import java.util.ArrayList;
import java.util.List;

public class AgentCatalogResponseDto {

    private String status;
    private List<AgentCatalogItemDto> agents = new ArrayList<>();

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public List<AgentCatalogItemDto> getAgents() {
        return agents;
    }

    public void setAgents(List<AgentCatalogItemDto> agents) {
        this.agents = agents;
    }
}
