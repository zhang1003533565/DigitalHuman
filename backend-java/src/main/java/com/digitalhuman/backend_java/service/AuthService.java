package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.LoginRequest;
import com.digitalhuman.backend_java.dto.LoginResponse;
import com.digitalhuman.backend_java.dto.RegisterRequest;
import com.digitalhuman.backend_java.model.AppUser;
import com.digitalhuman.backend_java.model.UserRole;
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

    public LoginResponse register(RegisterRequest request) {
        String username = request.getUsername().trim();
        String displayName = request.getDisplayName().trim();

        if (username.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户名不能为空");
        }

        if (displayName.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "昵称不能为空");
        }

        if (appUserRepository.findByUsername(username).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "用户名已存在");
        }

        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setDisplayName(displayName);
        user.setRole(UserRole.USER);

        AppUser savedUser = appUserRepository.save(user);
        String token = authTokenService.createToken(savedUser);
        return new LoginResponse(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getDisplayName(),
                savedUser.getRole(),
                token);
    }

    public void logout(String token) {
        if (token != null && !token.isBlank()) {
            authTokenService.revoke(token);
        }
    }
}
