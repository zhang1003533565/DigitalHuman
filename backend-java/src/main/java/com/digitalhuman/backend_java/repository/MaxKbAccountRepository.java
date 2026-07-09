package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.MaxKbAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface MaxKbAccountRepository extends JpaRepository<MaxKbAccount, Long>, JpaSpecificationExecutor<MaxKbAccount> {
}
