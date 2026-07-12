package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.UserFeedback;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;

public interface UserFeedbackRepository extends JpaRepository<UserFeedback, Long> {

    List<UserFeedback> findAllByOrderByCreatedAtDesc();
    List<UserFeedback> findBySessionIdOrderByCreatedAtDesc(String sessionId);

    @Query("select count(feedback) from UserFeedback feedback")
    long countPersistedFeedback();

    @Query("select count(feedback) from UserFeedback feedback where feedback.helpful = true")
    long countHelpfulFeedback();

    @Query("select avg(feedback.rating) from UserFeedback feedback")
    Double averagePersistedRating();

    @Query("select feedback.question, count(feedback) from UserFeedback feedback "
            + "where feedback.question is not null and trim(feedback.question) <> '' "
            + "group by feedback.question order by count(feedback) desc, feedback.question asc")
    List<Object[]> findPopularQuestions(Pageable pageable);

    @Query("select feedback.routeId, count(feedback) from UserFeedback feedback "
            + "where feedback.routeId is not null and trim(feedback.routeId) <> '' "
            + "group by feedback.routeId order by count(feedback) desc, feedback.routeId asc")
    List<Object[]> findPopularRoutes(Pageable pageable);
}
