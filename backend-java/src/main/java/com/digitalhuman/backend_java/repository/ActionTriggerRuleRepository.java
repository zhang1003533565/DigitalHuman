package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.ActionTriggerRule;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ActionTriggerRuleRepository extends JpaRepository<ActionTriggerRule, Long> {

    List<ActionTriggerRule> findByModelIdOrderByPriorityAscIdAsc(Long modelId);

    List<ActionTriggerRule> findByModelIdAndEnabledTrueOrderByPriorityAscIdAsc(Long modelId);

    void deleteByModelId(Long modelId);

    void deleteByModelActionId(Long modelActionId);
}
