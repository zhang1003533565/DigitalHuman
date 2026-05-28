package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.AppUser;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;

@Service
public class AuthTokenService {

    private final SecretKey secretKey;
    private final long expirationMs;

    public AuthTokenService(
            @Value("${jwt.secret:DigitalHumanDefaultSecretKey2024!@#$%^&*()1234567890}") String secret,
            @Value("${jwt.expiration-ms:604800000}") long expirationMs) {
        // 确保密钥至少 32 字节（256 位）
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        this.secretKey = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMs;
    }

    public String createToken(AppUser user) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("username", user.getUsername())
                .claim("displayName", user.getDisplayName())
                .claim("role", user.getRole().name())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(secretKey)
                .compact();
    }

    public Optional<AuthSession> getSession(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            Long userId = Long.parseLong(claims.getSubject());
            String username = claims.get("username", String.class);
            String displayName = claims.get("displayName", String.class);
            UserRole role = UserRole.valueOf(claims.get("role", String.class));

            return Optional.of(new AuthSession(userId, username, displayName, role));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public void revoke(String token) {
        // JWT 是无状态的，客户端删除 token 即可实现注销
        // 如需严格注销可加黑名单，这里简单处理
    }

    public boolean hasRole(String token, UserRole role) {
        return getSession(token).map(session -> session.getRole() == role).orElse(false);
    }
}
