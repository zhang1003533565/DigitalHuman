package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.config.LiveBroadcastConfig;
import com.digitalhuman.backend_java.model.LiveScriptItem;
import com.digitalhuman.backend_java.repository.LiveBroadcastVersionItemRepository;
import com.digitalhuman.backend_java.repository.LiveBroadcastVersionRepository;
import com.digitalhuman.backend_java.repository.LiveScriptItemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doThrow;

@DataJpaTest
@Import({LiveBroadcastService.class, LiveBroadcastConfig.class})
class LiveBroadcastPersistenceTests {
    @Autowired private LiveBroadcastService service;
    @Autowired private LiveScriptItemRepository drafts;
    @Autowired private LiveBroadcastVersionRepository versions;
    @Autowired private PlatformTransactionManager transactionManager;
    @SpyBean private LiveBroadcastVersionItemRepository snapshots;

    @Test
    void publishInsertsImmutableVersionAndItemsThroughJpa() {
        drafts.saveAll(List.of(draft("second", 3000L, 1), draft("first", 2000L, 0)));

        var published = service.publish();

        assertEquals(1L, versions.count());
        assertEquals(2L, snapshots.count());
        assertEquals(List.of("first", "second"), snapshots
                .findByVersionIdOrderBySortOrderAscIdAsc(published.versionId())
                .stream().map(item -> item.getTitle()).toList());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void publishRollsBackJpaVersionWhenSnapshotInsertFails() {
        drafts.save(draft("only", 2000L, 0));
        doThrow(new IllegalStateException("snapshot insert failed")).when(snapshots).saveAll(anyList());

        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        assertThrows(IllegalStateException.class, () -> transaction.executeWithoutResult(ignored -> service.publish()));

        assertEquals(0L, versions.count());
        assertEquals(0L, snapshots.count());
    }

    private LiveScriptItem draft(String title, long durationMs, int sortOrder) {
        LiveScriptItem item = new LiveScriptItem();
        item.setTitle(title);
        item.setContent(title + " content");
        item.setDurationMs(durationMs);
        item.setSortOrder(sortOrder);
        item.setEnabled(true);
        return item;
    }
}
