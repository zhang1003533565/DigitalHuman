package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.ModelEmotion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ModelEmotionRepository extends JpaRepository<ModelEmotion, Long> {
    
    List<ModelEmotion> findByModelId(Long modelId);
    
    List<ModelEmotion> findByModelIdAndEnabledTrue(Long modelId);
    
    Optional<ModelEmotion> findByModelIdAndEmotionId(Long modelId, Long emotionId);
    
    boolean existsByModelIdAndEmotionId(Long modelId, Long emotionId);
    
    void deleteByModelIdAndEmotionId(Long modelId, Long emotionId);
}
