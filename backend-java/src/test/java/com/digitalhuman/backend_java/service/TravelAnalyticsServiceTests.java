package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsRecordRequest;
import com.digitalhuman.backend_java.model.TravelAnalyticsRecord;
import com.digitalhuman.backend_java.model.TravelAnalyticsSourceState;
import com.digitalhuman.backend_java.repository.TravelAnalyticsRecordRepository;
import jakarta.persistence.EntityManager;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TravelAnalyticsServiceTests {

    @Test
    void createRecordLocksBeforeWriteAndMarksDataChangedAfterSuccessfulSave() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        TravelAnalyticsSourceStateService sourceStateService = mock(TravelAnalyticsSourceStateService.class);
        TravelAnalyticsSourceState lockedState = new TravelAnalyticsSourceState();
        when(sourceStateService.lockState()).thenReturn(lockedState);
        when(repository.findByTourist_idIgnoreCase("visitor-1")).thenReturn(Optional.empty());
        when(repository.save(any(TravelAnalyticsRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));
        TravelAnalyticsService service = new TravelAnalyticsService(repository, sourceStateService);

        TravelAnalyticsRecord created = service.createRecord(request("visitor-1"));

        assertEquals("visitor-1", created.getTourist_id());
        var order = inOrder(sourceStateService, repository);
        order.verify(sourceStateService).lockState();
        order.verify(repository).save(any(TravelAnalyticsRecord.class));
        order.verify(sourceStateService).markDataChanged(lockedState);
    }

    @Test
    void updateRecordLocksBeforeWriteAndMarksDataChangedAfterSuccessfulSave() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        TravelAnalyticsSourceStateService sourceStateService = mock(TravelAnalyticsSourceStateService.class);
        TravelAnalyticsSourceState lockedState = new TravelAnalyticsSourceState();
        when(sourceStateService.lockState()).thenReturn(lockedState);
        TravelAnalyticsRecord existing = new TravelAnalyticsRecord();
        existing.setId(9L);
        existing.setTourist_id("visitor-9");
        when(repository.findById(9L)).thenReturn(Optional.of(existing));
        when(repository.findByTourist_idIgnoreCaseAndIdNot("visitor-9", 9L)).thenReturn(Optional.empty());
        when(repository.save(any(TravelAnalyticsRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));
        TravelAnalyticsService service = new TravelAnalyticsService(repository, sourceStateService);

        TravelAnalyticsRecord updated = service.updateRecord(9L, request("visitor-9"));

        assertEquals("visitor-9", updated.getTourist_id());
        var order = inOrder(sourceStateService, repository);
        order.verify(sourceStateService).lockState();
        order.verify(repository).save(existing);
        order.verify(sourceStateService).markDataChanged(lockedState);
    }

    @Test
    void deleteRecordLocksBeforeWriteAndMarksDataChangedAfterSuccessfulDelete() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        TravelAnalyticsSourceStateService sourceStateService = mock(TravelAnalyticsSourceStateService.class);
        TravelAnalyticsSourceState lockedState = new TravelAnalyticsSourceState();
        when(sourceStateService.lockState()).thenReturn(lockedState);
        when(repository.existsById(11L)).thenReturn(true);
        TravelAnalyticsService service = new TravelAnalyticsService(repository, sourceStateService);

        service.deleteRecord(11L);

        var order = inOrder(sourceStateService, repository);
        order.verify(sourceStateService).lockState();
        order.verify(repository).deleteById(11L);
        order.verify(sourceStateService).markDataChanged(lockedState);
    }

    @Test
    void successfulImportLocksBeforeWriteAndMarksDataChangedExactlyOnce() throws Exception {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        TravelAnalyticsSourceStateService sourceStateService = mock(TravelAnalyticsSourceStateService.class);
        TravelAnalyticsSourceState lockedState = new TravelAnalyticsSourceState();
        when(sourceStateService.lockState()).thenReturn(lockedState);
        EntityManager entityManager = mock(EntityManager.class);
        when(repository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));
        TravelAnalyticsService service = new TravelAnalyticsService(repository, sourceStateService);
        service.setEntityManagerForTests(entityManager);

        service.importFromExcel(importFile(), false);

        ArgumentCaptor<java.lang.Iterable<TravelAnalyticsRecord>> captor = ArgumentCaptor.forClass(java.lang.Iterable.class);
        verify(repository).saveAll(captor.capture());
        verify(repository).flush();
        verify(entityManager).clear();
        var order = inOrder(sourceStateService, repository);
        order.verify(sourceStateService).lockState();
        order.verify(repository).saveAll(any());
        order.verify(sourceStateService).markDataChanged(lockedState);
        verify(sourceStateService, times(1)).markDataChanged(lockedState);
        verify(repository, never()).deleteAllInBatch();
    }

    @Test
    void failedImportDoesNotMarkDataChanged() throws Exception {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        TravelAnalyticsSourceStateService sourceStateService = mock(TravelAnalyticsSourceStateService.class);
        TravelAnalyticsSourceState lockedState = new TravelAnalyticsSourceState();
        when(sourceStateService.lockState()).thenReturn(lockedState);
        EntityManager entityManager = mock(EntityManager.class);
        when(repository.saveAll(any())).thenThrow(new IllegalStateException("database unavailable"));
        TravelAnalyticsService service = new TravelAnalyticsService(repository, sourceStateService);
        service.setEntityManagerForTests(entityManager);

        org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> service.importFromExcel(importFile(), false));

        verify(sourceStateService, never()).markDataChanged(any());
    }

    @Test
    void rejectedCreateDoesNotLockOrIncrementVersion() {
        TravelAnalyticsRecordRepository repository = mock(TravelAnalyticsRecordRepository.class);
        TravelAnalyticsSourceStateService sourceStateService = mock(TravelAnalyticsSourceStateService.class);
        TravelAnalyticsService service = new TravelAnalyticsService(repository, sourceStateService);

        org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> service.createRecord(request(" ")));

        verify(sourceStateService, never()).lockState();
        verify(sourceStateService, never()).markDataChanged(any());
    }

    private TravelAnalyticsRecordRequest request(String touristId) {
        TravelAnalyticsRecordRequest request = new TravelAnalyticsRecordRequest();
        request.setTourist_id(touristId);
        request.setUser_nickname("游客");
        request.setAge("30");
        request.setGender("女");
        request.setAttraction_name("灵山胜境");
        request.setAttraction_content("内容");
        request.setAttraction_type("景区");
        request.setVisit_date("2026-07-18");
        request.setStay_duration("120分钟");
        request.setTicket_cost("50");
        request.setFood_cost("20");
        request.setShopping_cost("30");
        request.setTransport_cost("10");
        request.setEntertainment_cost("0");
        request.setTotal_cost("110");
        request.setGroup_size("2");
        request.setSatisfaction("5");
        return request;
    }

    private MockMultipartFile importFile() throws IOException {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("travel_analytics_template");
            var header = sheet.createRow(0);
            String[] headers = {
                    "tourist_id", "user_nickname", "age", "gender", "attraction_name", "attraction_content",
                    "attraction_type", "visit_date", "stay_duration", "ticket_cost", "food_cost",
                    "shopping_cost", "transport_cost", "entertainment_cost", "total_cost", "group_size",
                    "satisfaction"
            };
            for (int index = 0; index < headers.length; index++) {
                header.createCell(index).setCellValue(headers[index]);
            }
            var row = sheet.createRow(1);
            String[] values = {
                    "visitor-import-1", "游客甲", "30", "女", "灵山胜境", "内容",
                    "景区", "2026-07-18", "120分钟", "50", "20",
                    "30", "10", "0", "110", "2",
                    "5"
            };
            for (int index = 0; index < values.length; index++) {
                row.createCell(index).setCellValue(values[index]);
            }
            workbook.write(outputStream);
            return new MockMultipartFile(
                    "file",
                    "travel-analytics.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    outputStream.toByteArray()
            );
        }
    }
}
