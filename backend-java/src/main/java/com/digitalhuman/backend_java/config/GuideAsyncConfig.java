package com.digitalhuman.backend_java.config;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.slf4j.MDC;

@Configuration
public class GuideAsyncConfig {
    @Bean
    Executor guideStreamExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(64);
        executor.setThreadNamePrefix("guide-stream-");
        executor.setTaskDecorator(task -> {
            var submittingContext = MDC.getCopyOfContextMap();
            return () -> {
                var workerContext = MDC.getCopyOfContextMap();
                try {
                    if (submittingContext == null) {
                        MDC.clear();
                    } else {
                        MDC.setContextMap(submittingContext);
                    }
                    task.run();
                } finally {
                    MDC.clear();
                    if (workerContext != null) {
                        MDC.setContextMap(workerContext);
                    }
                }
            };
        });
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.initialize();
        return executor;
    }
}
