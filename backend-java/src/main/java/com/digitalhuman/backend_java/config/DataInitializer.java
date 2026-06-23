package com.digitalhuman.backend_java.config;

import com.digitalhuman.backend_java.model.AppUser;
import com.digitalhuman.backend_java.repository.AppUserRepository;
import com.digitalhuman.backend_java.service.AdminSettingsService;
import com.digitalhuman.backend_java.service.ScenicRouteService;
import com.digitalhuman.backend_java.service.TravelTipService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.security.crypto.password.PasswordEncoder;

@Component
public class DataInitializer implements CommandLineRunner {

    private final AuthProperties authProperties;
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminSettingsService adminSettingsService;
    private final ScenicRouteService scenicRouteService;
    private final TravelTipService travelTipService;

    public DataInitializer(
            AuthProperties authProperties,
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder,
            AdminSettingsService adminSettingsService,
            ScenicRouteService scenicRouteService,
            TravelTipService travelTipService) {
        this.authProperties = authProperties;
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminSettingsService = adminSettingsService;
        this.scenicRouteService = scenicRouteService;
        this.travelTipService = travelTipService;
    }

    @Override
    public void run(String... args) {
        adminSettingsService.seedDefaultsIfMissing();
        scenicRouteService.seedDefaultsIfMissing();
        travelTipService.seedDefaultsIfMissing();

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
