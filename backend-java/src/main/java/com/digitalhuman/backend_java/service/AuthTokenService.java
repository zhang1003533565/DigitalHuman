package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.AppUser;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.UserRole;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthTokenService {

    private final Map<String, AuthSession> sessions = new ConcurrentHashMap<>();

    public String createToken(AppUser user) {
        String token = UUID.randomUUID().toString().replace("-", "");
        sessions.put(token, new AuthSession(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getRole()
        ));
        return token;
    }

    public Optional<AuthSession> getSession(String token) {
        return Optional.ofNullable(sessions.get(token));
    }

    public void revoke(String token) {
        sessions.remove(token);
    }

    public boolean hasRole(String token, UserRole role) {
        return getSession(token).map(session -> session.getRole() == role).orElse(false);
    }
}
