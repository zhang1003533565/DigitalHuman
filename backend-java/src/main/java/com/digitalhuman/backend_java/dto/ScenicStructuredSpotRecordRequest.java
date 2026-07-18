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
    private Boolean audio_enabled = false;
    private Boolean live_enabled = false;
    private String default_experience;
    private Long bound_voice_script_id;
    private String live_source_type;
    private String live_video_url;
    private String live_stream_url;
    private String camera_stream_key;

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

    public Boolean getAudio_enabled() {
        return audio_enabled;
    }

    public void setAudio_enabled(Boolean audio_enabled) {
        this.audio_enabled = audio_enabled;
    }

    public Boolean getLive_enabled() {
        return live_enabled;
    }

    public void setLive_enabled(Boolean live_enabled) {
        this.live_enabled = live_enabled;
    }

    public String getDefault_experience() {
        return default_experience;
    }

    public void setDefault_experience(String default_experience) {
        this.default_experience = default_experience;
    }

    public Long getBound_voice_script_id() {
        return bound_voice_script_id;
    }

    public void setBound_voice_script_id(Long bound_voice_script_id) {
        this.bound_voice_script_id = bound_voice_script_id;
    }

    public String getLive_source_type() {
        return live_source_type;
    }

    public void setLive_source_type(String live_source_type) {
        this.live_source_type = live_source_type;
    }

    public String getLive_video_url() {
        return live_video_url;
    }

    public void setLive_video_url(String live_video_url) {
        this.live_video_url = live_video_url;
    }

    public String getLive_stream_url() {
        return live_stream_url;
    }

    public void setLive_stream_url(String live_stream_url) {
        this.live_stream_url = live_stream_url;
    }

    public String getCamera_stream_key() {
        return camera_stream_key;
    }

    public void setCamera_stream_key(String camera_stream_key) {
        this.camera_stream_key = camera_stream_key;
    }
}
