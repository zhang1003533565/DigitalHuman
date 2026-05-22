package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.AdminProviderConfig;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminProviderConfigRepository extends JpaRepository<AdminProviderConfig, Long> {

    List<AdminProviderConfig> findAllByOrderByProviderAsc();

    Optional<AdminProviderConfig> findByProviderIgnoreCase(String provider);
}
