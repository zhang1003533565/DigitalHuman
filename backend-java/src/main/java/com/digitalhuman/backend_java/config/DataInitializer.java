package com.digitalhuman.backend_java.config;

import com.digitalhuman.backend_java.model.AppUser;
import com.digitalhuman.backend_java.repository.AppUserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.security.crypto.password.PasswordEncoder;

@Component
public class DataInitializer implements CommandLineRunner {

    private final AuthProperties authProperties;
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(
            AuthProperties authProperties,
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder) {
        this.authProperties = authProperties;
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        for (AuthProperties.SeedUser seedUser : authProperties.getSeedUsers()) {
            appUserRepository.findByUsername(seedUser.getUsername()).orElseGet(() -> {
                AppUser user = new AppUser();
                user.setUsername(seedUser.getUsername());
                user.setPassword(passwordEncoder.encode(seedUser.getPassword()));
                user.setDisplayName(seedUser.getDisplayName());
                user.setRole(seedUser.getRole());
                return appUserRepository.save(user);
            });
        }
    }
}
