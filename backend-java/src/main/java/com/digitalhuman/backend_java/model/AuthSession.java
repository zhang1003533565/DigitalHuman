package com.digitalhuman.backend_java.model;

import java.time.Instant;

public class AuthSession {

    private final Long userId;
    private final String username;
    private final String displayName;
    private final UserRole role;
    private final Instant createdAt;

    public AuthSession(Long userId, String username, String displayName, UserRole role) {
        this.userId = userId;
        this.username = username;
        this.displayName = displayName;
        this.role = role;
        this.createdAt = Instant.now();
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

    public Instant getCreatedAt() {
        return createdAt;
    }
}
