package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.AdminModelConfig;
import com.digitalhuman.backend_java.model.ModelCategory;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminModelConfigRepository extends JpaRepository<AdminModelConfig, Long> {

    List<AdminModelConfig> findAllByOrderByCategoryAscProviderAscModelIdAsc();

    List<AdminModelConfig> findByCategoryOrderByProviderAscModelIdAsc(ModelCategory category);

    Optional<AdminModelConfig> findByCategoryAndModelIdIgnoreCase(ModelCategory category, String modelId);

    List<AdminModelConfig> findByProviderIgnoreCaseOrderByCategoryAscModelIdAsc(String provider);
}
