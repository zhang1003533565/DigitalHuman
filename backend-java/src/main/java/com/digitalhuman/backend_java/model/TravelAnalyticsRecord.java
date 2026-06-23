package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "travel_analytics_record")
public class TravelAnalyticsRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tourist_id", nullable = false, length = 100)
    private String tourist_id;

    @Column(name = "user_nickname", length = 100)
    private String user_nickname;

    @Column(name = "age", length = 20)
    private String age;

    @Column(name = "gender", length = 20)
    private String gender;

    @Column(name = "attraction_name", length = 255)
    private String attraction_name;

    @Column(name = "attraction_content", columnDefinition = "LONGTEXT")
    private String attraction_content;

    @Column(name = "attraction_type", length = 100)
    private String attraction_type;

    @Column(name = "visit_date", length = 40)
    private String visit_date;

    @Column(name = "stay_duration", length = 40)
    private String stay_duration;

    @Column(name = "ticket_cost", length = 40)
    private String ticket_cost;

    @Column(name = "food_cost", length = 40)
    private String food_cost;

    @Column(name = "shopping_cost", length = 40)
    private String shopping_cost;

    @Column(name = "transport_cost", length = 40)
    private String transport_cost;

    @Column(name = "entertainment_cost", length = 40)
    private String entertainment_cost;

    @Column(name = "total_cost", length = 40)
    private String total_cost;

    @Column(name = "group_size", length = 40)
    private String group_size;

    @Column(name = "satisfaction", length = 40)
    private String satisfaction;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
