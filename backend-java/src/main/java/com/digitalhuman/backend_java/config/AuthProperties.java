package com.digitalhuman.backend_java.config;

import com.digitalhuman.backend_java.model.UserRole;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.auth")
public class AuthProperties {

    private List<SeedUser> seedUsers = new ArrayList<>();

    public List<SeedUser> getSeedUsers() {
        return seedUsers;
    }

    public void setSeedUsers(List<SeedUser> seedUsers) {
        this.seedUsers = seedUsers;
    }

    public static class SeedUser {
        private String username;
        private String password;
        private String displayName;
        private UserRole role;

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }

        public UserRole getRole() {
            return role;
        }

        public void setRole(UserRole role) {
            this.role = role;
        }
    }
}
