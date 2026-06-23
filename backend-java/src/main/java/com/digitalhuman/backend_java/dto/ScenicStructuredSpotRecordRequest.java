package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.NotBlank;

public class ScenicStructuredSpotRecordRequest {

    private String scenic_name;

    @NotBlank(message = "景点ID不能为空")
    private String spot_id;

    private String spot_name;
    private String location;
    private String architecture_landscape_params;
    private String core_function;
    private String cultural_connotation;
    private String detailed_introduction;
    private String highlights;
    private String performance_open_info;
    private String remark;

    public String getScenic_name() {
        return scenic_name;
    }

    public void setScenic_name(String scenic_name) {
        this.scenic_name = scenic_name;
    }

    public String getSpot_id() {
        return spot_id;
    }

    public void setSpot_id(String spot_id) {
        this.spot_id = spot_id;
    }

    public String getSpot_name() {
        return spot_name;
    }

    public void setSpot_name(String spot_name) {
        this.spot_name = spot_name;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getArchitecture_landscape_params() {
        return architecture_landscape_params;
    }

    public void setArchitecture_landscape_params(String architecture_landscape_params) {
        this.architecture_landscape_params = architecture_landscape_params;
    }

    public String getCore_function() {
        return core_function;
    }

    public void setCore_function(String core_function) {
        this.core_function = core_function;
    }

    public String getCultural_connotation() {
        return cultural_connotation;
    }

    public void setCultural_connotation(String cultural_connotation) {
        this.cultural_connotation = cultural_connotation;
    }

    public String getDetailed_introduction() {
        return detailed_introduction;
    }

    public void setDetailed_introduction(String detailed_introduction) {
        this.detailed_introduction = detailed_introduction;
    }

    public String getHighlights() {
        return highlights;
    }

    public void setHighlights(String highlights) {
        this.highlights = highlights;
    }

    public String getPerformance_open_info() {
        return performance_open_info;
    }

    public void setPerformance_open_info(String performance_open_info) {
        this.performance_open_info = performance_open_info;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }
}
