package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.DigitalHumanModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface DigitalHumanModelRepository extends JpaRepository<DigitalHumanModel, Long> {
    
    Optional<DigitalHumanModel> findByModelKey(String modelKey);
    
    boolean existsByModelKey(String modelKey);
}
