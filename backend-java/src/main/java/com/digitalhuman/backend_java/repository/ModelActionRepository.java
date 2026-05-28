package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.ModelAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ModelActionRepository extends JpaRepository<ModelAction, Long> {
    
    List<ModelAction> findByModelId(Long modelId);
    
    List<ModelAction> findByModelIdAndEnabledTrue(Long modelId);
    
    Optional<ModelAction> findByModelIdAndActionKey(Long modelId, String actionKey);
    
    void deleteByModelId(Long modelId);
}
