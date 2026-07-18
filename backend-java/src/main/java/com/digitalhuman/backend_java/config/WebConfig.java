package com.digitalhuman.backend_java.config;

import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;

    @Value("${scenic.media-dir:${user.dir}/media/scenic}")
    private String scenicMediaDir;

    public WebConfig(AuthInterceptor authInterceptor) {
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("*")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders(TraceIdFilter.TRACE_ID_HEADER)
                .maxAge(3600);
    }

    @Bean
    FilterRegistrationBean<TraceIdFilter> traceIdFilterRegistration() {
        FilterRegistrationBean<TraceIdFilter> registration = new FilterRegistrationBean<>(new TraceIdFilter());
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        registration.addUrlPatterns("/*");
        return registration;
    }

    @Override
    public void addInterceptors(org.springframework.web.servlet.config.annotation.InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/admin/**", "/api/user/**", "/api/knowledge/maxkb/**")
                .excludePathPatterns("/api/auth/**", "/api/tts/**", "/error");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/api/tts/audio/**")
                .addResourceLocations("file:tts/");
        registry.addResourceHandler("/api/scenic-media/**")
                .addResourceLocations(Path.of(scenicMediaDir).toAbsolutePath().normalize().toUri().toString());
        Path live2dRoot = resolveLive2dRoot();
        if (Files.isDirectory(live2dRoot)) {
            registry.addResourceHandler("/live2d/**")
                    .addResourceLocations(live2dRoot.toUri().toString());
        }
    }

    private Path resolveLive2dRoot() {
        Path current = Path.of("").toAbsolutePath();
        Path candidate = current.resolve("frontend-visitor").resolve("public").resolve("live2d");
        if (Files.isDirectory(candidate)) {
            return candidate;
        }
        Path parent = current.getParent();
        if (parent != null) {
            return parent.resolve("frontend-visitor").resolve("public").resolve("live2d");
        }
        return candidate;
    }
}
