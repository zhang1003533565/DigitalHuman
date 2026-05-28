package com.digitalhuman.backend_java.dto;

import java.util.ArrayList;
import java.util.List;

public class AgentModelBindingPayloadDto {

    private List<AgentModelBindingItemDto> items = new ArrayList<>();

    public List<AgentModelBindingItemDto> getItems() {
        return items;
    }

    public void setItems(List<AgentModelBindingItemDto> items) {
        this.items = items;
    }
}
