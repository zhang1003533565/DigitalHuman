package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.config.AuthInterceptor;
import com.digitalhuman.backend_java.dto.ScenicKnowledgePreviewDto;
import com.digitalhuman.backend_java.dto.ScenicKnowledgePublicationDto;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.service.ScenicKnowledgePublicationService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminScenicKnowledgePublicationControllerTests {

    @Test
    void previewRouteDelegatesWithoutRequiringAdminWritePrivileges() throws Exception {
        ScenicKnowledgePublicationService service = mock(ScenicKnowledgePublicationService.class);
        ScenicKnowledgePreviewDto preview = new ScenicKnowledgePreviewDto();
        preview.setRecordId(8L);
        preview.setFacilityId(12L);
        when(service.preview(8L)).thenReturn(preview);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminScenicKnowledgePublicationController(service)).build();

        mvc.perform(get("/api/admin/scenic-knowledge/records/8/preview"))
                .andExpect(status().isOk());

        verify(service).preview(8L);
    }

    @Test
    void publishRouteRejectsObserverRequests() throws Exception {
        ScenicKnowledgePublicationService service = mock(ScenicKnowledgePublicationService.class);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminScenicKnowledgePublicationController(service)).build();

        mvc.perform(post("/api/admin/scenic-knowledge/records/8/publish")
                        .requestAttr(AuthInterceptor.REQUEST_ATTR_AUTH_SESSION, new AuthSession(2L, "observer", "观察员", UserRole.OBSERVER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":3,\"knowledgeId\":\"kb-1\",\"knowledgeName\":\"灵山知识库\"}"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(service);
    }

    @Test
    void publishRouteDelegatesWhenAdminSessionIsPresent() throws Exception {
        ScenicKnowledgePublicationService service = mock(ScenicKnowledgePublicationService.class);
        ScenicKnowledgePublicationDto publication = new ScenicKnowledgePublicationDto();
        publication.setFacilityId(12L);
        publication.setStatus("published");
        when(service.publish(eq(8L), any(), any())).thenReturn(publication);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminScenicKnowledgePublicationController(service)).build();

        mvc.perform(post("/api/admin/scenic-knowledge/records/8/publish")
                        .requestAttr(AuthInterceptor.REQUEST_ATTR_AUTH_SESSION, new AuthSession(1L, "admin", "管理员", UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":3,\"knowledgeId\":\"kb-1\",\"knowledgeName\":\"灵山知识库\"}"))
                .andExpect(status().isOk());

        verify(service).publish(eq(8L), any(), any());
    }

    @Test
    void withdrawRouteRejectsUnauthenticatedRequests() throws Exception {
        ScenicKnowledgePublicationService service = mock(ScenicKnowledgePublicationService.class);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminScenicKnowledgePublicationController(service)).build();

        mvc.perform(post("/api/admin/scenic-knowledge/facilities/12/withdraw"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(service);
    }

    @Test
    void statusRouteDelegatesWithoutWriteSessionChecks() throws Exception {
        ScenicKnowledgePublicationService service = mock(ScenicKnowledgePublicationService.class);
        ScenicKnowledgePublicationDto publication = new ScenicKnowledgePublicationDto();
        publication.setFacilityId(12L);
        publication.setStatus("published");
        when(service.getStatus(12L)).thenReturn(publication);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new AdminScenicKnowledgePublicationController(service)).build();

        mvc.perform(get("/api/admin/scenic-knowledge/facilities/12/status"))
                .andExpect(status().isOk());

        verify(service).getStatus(12L);
    }
}
