package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.Emotion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface EmotionRepository extends JpaRepository<Emotion, Long> {
    
    Optional<Emotion> findByEmotionKey(String emotionKey);
    
    List<Emotion> findByEnabledTrueOrderBySortOrderAsc();
}
