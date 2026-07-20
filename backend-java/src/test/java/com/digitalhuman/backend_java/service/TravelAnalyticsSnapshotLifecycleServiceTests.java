package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.repository.TravelAnalyticsSnapshotBatchRepository;
import jakarta.persistence.LockTimeoutException;
import jakarta.persistence.PessimisticLockException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.orm.jpa.JpaSystemException;
import org.springframework.transaction.TransactionSystemException;
import org.springframework.web.server.ResponseStatusException;

import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class TravelAnalyticsSnapshotLifecycleServiceTests {

    private final TravelAnalyticsSnapshotBatchRepository batches =
            mock(TravelAnalyticsSnapshotBatchRepository.class);
    private final TravelAnalyticsSourceStateService sourceStateService =
            mock(TravelAnalyticsSourceStateService.class);
    private final TravelAnalyticsSnapshotLifecycleService service =
            new TravelAnalyticsSnapshotLifecycleService(batches, sourceStateService);

    @ParameterizedTest
    @MethodSource("pessimisticLockFailures")
    void createBuildingMapsPessimisticLockFailureCauseChainToConflict(RuntimeException lockFailure) {
        doThrow(lockFailure).when(sourceStateService).lockState();

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.createBuilding(admin()));

        assertEquals(409, exception.getStatusCode().value());
        assertEquals("统计快照正在生成", exception.getReason());
        assertSame(lockFailure, exception.getCause());
        verifyNoInteractions(batches);
    }

    @Test
    void createBuildingDoesNotTranslateUnrelatedRepositoryFailure() {
        DataAccessResourceFailureException repositoryFailure =
                new DataAccessResourceFailureException("database unavailable");
        doThrow(repositoryFailure).when(sourceStateService).lockState();

        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> service.createBuilding(admin()));

        assertSame(repositoryFailure, exception);
        verifyNoInteractions(batches);
    }

    private static Stream<RuntimeException> pessimisticLockFailures() {
        return Stream.of(
                new CannotAcquireLockException("lock busy"),
                new JpaSystemException(new PessimisticLockException("lock busy")),
                new TransactionSystemException(
                        "transaction failed",
                        new LockTimeoutException("lock busy")));
    }

    private AuthSession admin() {
        return new AuthSession(1L, "admin", "管理员", UserRole.ADMIN);
    }
}
