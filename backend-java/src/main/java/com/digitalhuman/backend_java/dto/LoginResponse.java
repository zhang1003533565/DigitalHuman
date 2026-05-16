package com.digitalhuman.backend_java.dto;

import com.digitalhuman.backend_java.model.UserRole;

public class LoginResponse {

    private final Long userId;
    private final String username;
    private final String displayName;
    private final UserRole role;

    public LoginResponse(Long userId, String username, String displayName, UserRole role) {
        this.userId = userId;
        this.username = username;
        this.displayName = displayName;
        this.role = role;
    }

    public Long getUserId() {
        return userId;
    }

    public String getUsername() {
        return username;
    }

    public String getDisplayName() {
        return displayName;
    }

    public UserRole getRole() {
        return role;
    }
}
