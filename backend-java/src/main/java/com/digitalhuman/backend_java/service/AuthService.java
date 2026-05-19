package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.LoginRequest;
import com.digitalhuman.backend_java.dto.LoginResponse;
import com.digitalhuman.backend_java.model.AppUser;
import com.digitalhuman.backend_java.repository.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthTokenService authTokenService;

    public AuthService(
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder,
            AuthTokenService authTokenService) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.authTokenService = authTokenService;
    }

    public LoginResponse login(LoginRequest request) {
        AppUser user = appUserRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户名或密码错误"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户名或密码错误");
        }

        String token = authTokenService.createToken(user);
        return new LoginResponse(user.getId(), user.getUsername(), user.getDisplayName(), user.getRole(), token);
    }

    public void logout(String token) {
        if (token != null && !token.isBlank()) {
            authTokenService.revoke(token);
        }
    }
}
