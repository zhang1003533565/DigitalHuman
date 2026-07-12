package com.digitalhuman.backend_java.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

class GuideAsyncConfigTests {

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void executorCopiesTraceContextAndDoesNotLeakIt() throws Exception {
        Executor executor = new GuideAsyncConfig().guideStreamExecutor();
        try {
            MDC.put(TraceIdFilter.MDC_KEY, "trace-async-1234");
            AtomicReference<String> copiedTrace = new AtomicReference<>();
            CountDownLatch first = new CountDownLatch(1);
            executor.execute(() -> {
                copiedTrace.set(MDC.get(TraceIdFilter.MDC_KEY));
                first.countDown();
            });
            assertThat(first.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(copiedTrace.get()).isEqualTo("trace-async-1234");
            assertThat(MDC.get(TraceIdFilter.MDC_KEY)).isEqualTo("trace-async-1234");

            MDC.clear();
            AtomicReference<String> leakedTrace = new AtomicReference<>("unset");
            CountDownLatch second = new CountDownLatch(1);
            executor.execute(() -> {
                leakedTrace.set(MDC.get(TraceIdFilter.MDC_KEY));
                second.countDown();
            });
            assertThat(second.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(leakedTrace.get()).isNull();
            assertThat(MDC.get(TraceIdFilter.MDC_KEY)).isNull();
        } finally {
            ((ThreadPoolTaskExecutor) executor).shutdown();
        }
    }
}
