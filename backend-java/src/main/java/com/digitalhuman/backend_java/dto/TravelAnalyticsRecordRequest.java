package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.NotBlank;

public class TravelAnalyticsRecordRequest {

    @NotBlank(message = "tourist_id 不能为空")
    private String tourist_id;
    private String user_nickname;
    private String age;
    private String gender;
    private String attraction_name;
    private String attraction_content;
    private String attraction_type;
    private String visit_date;
    private String stay_duration;
    private String ticket_cost;
    private String food_cost;
    private String shopping_cost;
    private String transport_cost;
    private String entertainment_cost;
    private String total_cost;
    private String group_size;
    private String satisfaction;

    public String getTourist_id() {
        return tourist_id;
    }

    public void setTourist_id(String tourist_id) {
        this.tourist_id = tourist_id;
    }

    public String getUser_nickname() {
        return user_nickname;
    }

    public void setUser_nickname(String user_nickname) {
        this.user_nickname = user_nickname;
    }

    public String getAge() {
        return age;
    }

    public void setAge(String age) {
        this.age = age;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getAttraction_name() {
        return attraction_name;
    }

    public void setAttraction_name(String attraction_name) {
        this.attraction_name = attraction_name;
    }

    public String getAttraction_content() {
        return attraction_content;
    }

    public void setAttraction_content(String attraction_content) {
        this.attraction_content = attraction_content;
    }

    public String getAttraction_type() {
        return attraction_type;
    }

    public void setAttraction_type(String attraction_type) {
        this.attraction_type = attraction_type;
    }

    public String getVisit_date() {
        return visit_date;
    }

    public void setVisit_date(String visit_date) {
        this.visit_date = visit_date;
    }

    public String getStay_duration() {
        return stay_duration;
    }

    public void setStay_duration(String stay_duration) {
        this.stay_duration = stay_duration;
    }

    public String getTicket_cost() {
        return ticket_cost;
    }

    public void setTicket_cost(String ticket_cost) {
        this.ticket_cost = ticket_cost;
    }

    public String getFood_cost() {
        return food_cost;
    }

    public void setFood_cost(String food_cost) {
        this.food_cost = food_cost;
    }

    public String getShopping_cost() {
        return shopping_cost;
    }

    public void setShopping_cost(String shopping_cost) {
        this.shopping_cost = shopping_cost;
    }

    public String getTransport_cost() {
        return transport_cost;
    }

    public void setTransport_cost(String transport_cost) {
        this.transport_cost = transport_cost;
    }

    public String getEntertainment_cost() {
        return entertainment_cost;
    }

    public void setEntertainment_cost(String entertainment_cost) {
        this.entertainment_cost = entertainment_cost;
    }

    public String getTotal_cost() {
        return total_cost;
    }

    public void setTotal_cost(String total_cost) {
        this.total_cost = total_cost;
    }

    public String getGroup_size() {
        return group_size;
    }

    public void setGroup_size(String group_size) {
        this.group_size = group_size;
    }

    public String getSatisfaction() {
        return satisfaction;
    }

    public void setSatisfaction(String satisfaction) {
        this.satisfaction = satisfaction;
    }
}
