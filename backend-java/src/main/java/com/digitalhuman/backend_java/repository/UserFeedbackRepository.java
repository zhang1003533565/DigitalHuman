package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.UserFeedback;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserFeedbackRepository extends JpaRepository<UserFeedback, Long> {

    List<UserFeedback> findAllByOrderByCreatedAtDesc();
}
