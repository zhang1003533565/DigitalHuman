package com.digitalhuman.backend_java.config;

import com.digitalhuman.backend_java.service.LiveTimelineResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class LiveBroadcastConfig {
    @Bean public Clock liveBroadcastClock() { return Clock.systemUTC(); }
    @Bean public LiveTimelineResolver liveTimelineResolver() { return new LiveTimelineResolver(); }
}
