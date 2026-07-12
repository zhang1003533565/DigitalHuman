package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.config.AuthInterceptor;
import com.digitalhuman.backend_java.dto.LiveScriptItemDto;
import com.digitalhuman.backend_java.dto.VisitorLiveItemDto;
import com.digitalhuman.backend_java.dto.VisitorLiveStatusDto;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.service.AuthTokenService;
import com.digitalhuman.backend_java.service.LiveBroadcastService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class LiveBroadcastControllerTests {
    private final LiveBroadcastService service = mock(LiveBroadcastService.class);
    private final AuthTokenService tokens = mock(AuthTokenService.class);
    private final JsonMapper mapper = JsonMapper.builder().addModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).build();
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(
            new AdminLiveBroadcastController(service), new UserLiveBroadcastController(service))
            .setMessageConverters(new org.springframework.http.converter.json.MappingJackson2HttpMessageConverter(mapper))
            .addInterceptors(new AuthInterceptor(tokens)).build();

    @Test
    void adminMutationRequiresAdmin() throws Exception {
        when(tokens.getSession("observer")).thenReturn(Optional.of(new AuthSession(1L,"o","o", UserRole.OBSERVER)));
        mvc.perform(post("/api/admin/live-broadcast/publish").header("Authorization", "Bearer observer"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void adminReadAlsoRequiresAdmin() throws Exception {
        when(tokens.getSession("observer")).thenReturn(Optional.of(new AuthSession(1L,"o","o", UserRole.OBSERVER)));
        mvc.perform(get("/api/admin/live-broadcast/items").header("Authorization", "Bearer observer"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void adminCanReadDraftItems() throws Exception {
        when(tokens.getSession("admin")).thenReturn(Optional.of(new AuthSession(3L,"a","a", UserRole.ADMIN)));
        when(service.listItems()).thenReturn(List.of(new LiveScriptItemDto(7L, "title", "content", 5000L, 0, true, null)));

        mvc.perform(get("/api/admin/live-broadcast/items").header("Authorization", "Bearer admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(7L))
                .andExpect(jsonPath("$[0].enabled").value(true));
        verify(service).listItems();
    }

    @Test
    void regularUserCannotAccessAdminLiveBroadcast() throws Exception {
        when(tokens.getSession("user-admin")).thenReturn(Optional.of(new AuthSession(2L,"u","u", UserRole.USER)));

        mvc.perform(get("/api/admin/live-broadcast/items").header("Authorization", "Bearer user-admin"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void visitorStatusRequiresLogin() throws Exception {
        mvc.perform(get("/api/user/live/status")).andExpect(status().isUnauthorized());
    }

    @Test
    void notPublishedReturnsOnlyStatusAndServerTime() throws Exception {
        loginUser();
        when(service.getVisitorStatus()).thenReturn(VisitorLiveStatusDto.notPublished(Instant.parse("2026-07-12T04:00:00Z")));
        mvc.perform(get("/api/user/live/status").header("Authorization", "Bearer user"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("notPublished"))
                .andExpect(jsonPath("$.serverTime").value("2026-07-12T04:00:00Z"))
                .andExpect(jsonPath("$.versionId").doesNotExist());
    }

    @Test
    void publishedStatusReturnsCompleteSnapshotWithoutDraftFields() throws Exception {
        loginUser();
        var item = new VisitorLiveItemDto(7L, "title", "content", 5000L, 0);
        when(service.getVisitorStatus()).thenReturn(new VisitorLiveStatusDto("published", Instant.parse("2026-07-12T04:00:05Z"),
                3L, Instant.parse("2026-07-12T04:00:00Z"), 5000L, 7L, 0, 0L, 0L, List.of(item)));
        mvc.perform(get("/api/user/live/status").header("Authorization", "Bearer user").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].title").value("title"))
                .andExpect(jsonPath("$.items[0].itemId").value(7L))
                .andExpect(jsonPath("$.items[0].id").doesNotExist())
                .andExpect(jsonPath("$.items[0].enabled").doesNotExist())
                .andExpect(jsonPath("$.items[0].updatedAt").doesNotExist());
    }

    private void loginUser() {
        when(tokens.getSession("user")).thenReturn(Optional.of(new AuthSession(2L,"u","u", UserRole.USER)));
    }
}
