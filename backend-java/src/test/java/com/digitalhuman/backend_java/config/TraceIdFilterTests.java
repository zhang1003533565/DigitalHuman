package com.digitalhuman.backend_java.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class TraceIdFilterTests {

    private final TraceIdFilter filter = new TraceIdFilter();

    @Test
    void generatesUuidWhenRequestHeaderIsMissing() throws Exception {
        MockHttpServletResponse response = filter(new MockHttpServletRequest());

        assertThat(response.getHeader(TraceIdFilter.TRACE_ID_HEADER)).isNotBlank();
        UUID.fromString(response.getHeader(TraceIdFilter.TRACE_ID_HEADER));
    }

    @Test
    void echoesValidRequestHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(TraceIdFilter.TRACE_ID_HEADER, "web-client_2026:request.42");

        assertThat(filter(request).getHeader(TraceIdFilter.TRACE_ID_HEADER))
                .isEqualTo("web-client_2026:request.42");
    }

    @Test
    void replacesInvalidCharactersAndInvalidLengthsWithUuid() throws Exception {
        for (String invalid : new String[] { "short", "contains spaces", "../dangerous", "a".repeat(129) }) {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader(TraceIdFilter.TRACE_ID_HEADER, invalid);

            String traceId = filter(request).getHeader(TraceIdFilter.TRACE_ID_HEADER);
            assertThat(traceId).isNotEqualTo(invalid);
            UUID.fromString(traceId);
        }
    }

    private MockHttpServletResponse filter(MockHttpServletRequest request) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
