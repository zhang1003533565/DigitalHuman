package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.ModelEmotionAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ModelEmotionActionRepository extends JpaRepository<ModelEmotionAction, Long> {
    
    List<ModelEmotionAction> findByModelEmotionId(Long modelEmotionId);

    Optional<ModelEmotionAction> findByModelEmotionIdAndModelActionId(Long modelEmotionId, Long modelActionId);
    
    void deleteByModelEmotionId(Long modelEmotionId);

    void deleteByModelActionId(Long modelActionId);
}
