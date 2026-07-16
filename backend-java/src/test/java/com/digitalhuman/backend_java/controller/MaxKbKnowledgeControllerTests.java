package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.config.AuthInterceptor;
import com.digitalhuman.backend_java.model.AuthSession;
import com.digitalhuman.backend_java.model.UserRole;
import com.digitalhuman.backend_java.service.MaxKbKnowledgeService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MaxKbKnowledgeControllerTests {

    @Test
    void updateParagraphRouteDelegatesToAccountScopedService() throws Exception {
        MaxKbKnowledgeService service = mock(MaxKbKnowledgeService.class);
        when(service.updateParagraph(eq(1L), eq("kb-1"), eq("doc-1"), eq("paragraph-1"), org.mockito.ArgumentMatchers.anyMap()))
                .thenReturn(Map.of("code", 200));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new MaxKbKnowledgeController(service)).build();

        mvc.perform(put("/api/admin/knowledge/maxkb/accounts/1/knowledges/kb-1/documents/doc-1/paragraphs/paragraph-1")
                        .requestAttr(
                                AuthInterceptor.REQUEST_ATTR_AUTH_SESSION,
                                new AuthSession(1L, "admin", "管理员", UserRole.ADMIN)
                        )
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"标题\",\"content\":\"正文\"}"))
                .andExpect(status().isOk());

        verify(service).updateParagraph(eq(1L), eq("kb-1"), eq("doc-1"), eq("paragraph-1"), org.mockito.ArgumentMatchers.anyMap());
    }

    @Test
    void listParagraphProblemsRouteDelegatesToAccountScopedService() throws Exception {
        MaxKbKnowledgeService service = mock(MaxKbKnowledgeService.class);
        when(service.listParagraphProblems(1L, "kb-1", "doc-1", "paragraph-1")).thenReturn(Map.of("code", 200));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new MaxKbKnowledgeController(service)).build();

        mvc.perform(get("/api/admin/knowledge/maxkb/accounts/1/knowledges/kb-1/documents/doc-1/paragraphs/paragraph-1/problems")
                        .requestAttr(
                                AuthInterceptor.REQUEST_ATTR_AUTH_SESSION,
                                new AuthSession(1L, "admin", "管理员", UserRole.ADMIN)
                        ))
                .andExpect(status().isOk());

        verify(service).listParagraphProblems(1L, "kb-1", "doc-1", "paragraph-1");
    }
}
