package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.UserFeedback;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

public interface UserFeedbackRepository extends JpaRepository<UserFeedback, Long> {

    List<UserFeedback> findAllByOrderByCreatedAtDesc();
    List<UserFeedback> findBySessionIdOrderByCreatedAtDesc(String sessionId);

    @Query("select count(feedback) from UserFeedback feedback")
    long countPersistedFeedback();

    @Query("select count(feedback) from UserFeedback feedback where feedback.helpful = true")
    long countHelpfulFeedback();

    @Query("select count(feedback) from UserFeedback feedback where feedback.createdAt >= :start and feedback.createdAt < :end")
    long countByCreatedAtBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("select count(feedback) from UserFeedback feedback where feedback.helpful = true and feedback.createdAt >= :start and feedback.createdAt < :end")
    long countHelpfulFeedbackByCreatedAtBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    long countByStatus(String status);

    @Query("select avg(feedback.rating) from UserFeedback feedback")
    Double averagePersistedRating();

    @Query("select avg(feedback.rating) from UserFeedback feedback where feedback.createdAt >= :start and feedback.createdAt < :end")
    Double averageRatingByCreatedAtBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("select feedback.question, count(feedback) from UserFeedback feedback "
            + "where feedback.question is not null and trim(feedback.question) <> '' "
            + "group by feedback.question order by count(feedback) desc, feedback.question asc")
    List<Object[]> findPopularQuestions(Pageable pageable);

    @Query("select feedback.routeId, count(feedback) from UserFeedback feedback "
            + "where feedback.routeId is not null and trim(feedback.routeId) <> '' "
            + "group by feedback.routeId order by count(feedback) desc, feedback.routeId asc")
    List<Object[]> findPopularRoutes(Pageable pageable);
}
