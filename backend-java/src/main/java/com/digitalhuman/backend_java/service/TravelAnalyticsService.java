package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelAnalyticsImportIssueDto;
import com.digitalhuman.backend_java.dto.TravelAnalyticsImportResult;
import com.digitalhuman.backend_java.dto.TravelAnalyticsRecordRequest;
import com.digitalhuman.backend_java.model.TravelAnalyticsRecord;
import com.digitalhuman.backend_java.repository.TravelAnalyticsRecordRepository;
import jakarta.transaction.Transactional;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class TravelAnalyticsService {

    private static final List<String> REQUIRED_HEADERS = List.of(
            "tourist_id",
            "user_nickname",
            "age",
            "gender",
            "attraction_name",
            "attraction_content",
            "attraction_type",
            "visit_date",
            "stay_duration",
            "ticket_cost",
            "food_cost",
            "shopping_cost",
            "transport_cost",
            "entertainment_cost",
            "total_cost",
            "group_size",
            "satisfaction"
    );

    private final TravelAnalyticsRecordRepository recordRepository;

    public TravelAnalyticsService(TravelAnalyticsRecordRepository recordRepository) {
        this.recordRepository = recordRepository;
    }

    public List<TravelAnalyticsRecord> listAll() {
        return recordRepository.findAllByOrderByIdAsc();
    }

    public TravelAnalyticsRecord getById(Long id) {
        return recordRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "记录不存在"));
    }

    @Transactional
    public TravelAnalyticsRecord createRecord(TravelAnalyticsRecordRequest request) {
        String touristId = normalize(request.getTourist_id());
        if (touristId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "tourist_id 不能为空");
        }
        if (recordRepository.findByTourist_idIgnoreCase(touristId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "tourist_id 已存在");
        }
        TravelAnalyticsRecord entity = new TravelAnalyticsRecord();
        applyRequest(entity, request);
        return recordRepository.save(entity);
    }

    @Transactional
    public TravelAnalyticsRecord updateRecord(Long id, TravelAnalyticsRecordRequest request) {
        TravelAnalyticsRecord entity = getById(id);
        String touristId = normalize(request.getTourist_id());
        if (touristId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "tourist_id 不能为空");
        }
        if (recordRepository.findByTourist_idIgnoreCaseAndIdNot(touristId, id).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "tourist_id 已存在");
        }
        applyRequest(entity, request);
        return recordRepository.save(entity);
    }

    @Transactional
    public void deleteRecord(Long id) {
        if (!recordRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "记录不存在");
        }
        recordRepository.deleteById(id);
    }

    public byte[] buildTemplateFile() {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("travel_analytics_template");
            Row header = sheet.createRow(0);
            for (int index = 0; index < REQUIRED_HEADERS.size(); index++) {
                header.createCell(index).setCellValue(REQUIRED_HEADERS.get(index));
                sheet.setColumnWidth(index, 18 * 256);
            }
            workbook.write(outputStream);
            return outputStream.toByteArray();
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "生成模板失败");
        }
    }

    @Transactional
    public TravelAnalyticsImportResult importFromExcel(MultipartFile file, boolean replaceAll) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "上传文件不能为空");
        }

        try (InputStream inputStream = file.getInputStream(); Workbook workbook = WorkbookFactory.create(inputStream)) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Excel 中未找到工作表");
            }

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Excel 缺少表头");
            }
            validateHeaders(headerRow);

            if (replaceAll) {
                recordRepository.deleteAllInBatch();
            }

            List<TravelAnalyticsRecord> rows = new ArrayList<>();
            List<TravelAnalyticsImportIssueDto> issues = new ArrayList<>();
            Set<String> touristIdSeen = new HashSet<>();
            int skippedEmptyCount = 0;
            int skippedDuplicateCount = 0;
            DataFormatter formatter = new DataFormatter();
            for (int rowIndex = 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null) {
                    skippedEmptyCount++;
                    continue;
                }
                ParseRowResult parsed = fromRow(row, formatter, rowIndex + 1);
                if (parsed.emptyRow()) {
                    skippedEmptyCount++;
                    continue;
                }
                if (parsed.issue() != null) {
                    issues.add(parsed.issue());
                    continue;
                }
                TravelAnalyticsRecord entity = parsed.entity();
                if (entity == null) {
                    continue;
                }
                String touristId = normalize(entity.getTourist_id());
                if (touristIdSeen.contains(touristId)) {
                    skippedDuplicateCount++;
                    issues.add(new TravelAnalyticsImportIssueDto(rowIndex + 1, "tourist_id 重复，已跳过"));
                    continue;
                }
                touristIdSeen.add(touristId);
                rows.add(entity);
            }

            if (!rows.isEmpty()) {
                recordRepository.saveAll(rows);
            }
            return new TravelAnalyticsImportResult(rows.size(), skippedEmptyCount, skippedDuplicateCount, issues);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "读取 Excel 失败：" + exception.getMessage());
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "解析 Excel 失败：" + exception.getMessage());
        }
    }

    private void validateHeaders(Row headerRow) {
        DataFormatter formatter = new DataFormatter();
        List<String> actual = new ArrayList<>();
        for (int index = 0; index < REQUIRED_HEADERS.size(); index++) {
            Cell cell = headerRow.getCell(index);
            actual.add(normalize(formatter.formatCellValue(cell)));
        }
        if (!REQUIRED_HEADERS.equals(actual)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Excel 表头不匹配，必须严格为：" + String.join(", ", REQUIRED_HEADERS)
            );
        }
    }

    private ParseRowResult fromRow(Row row, DataFormatter formatter, int rowNumber) {
        String touristId = read(row, 0, formatter);
        String userNickname = read(row, 1, formatter);
        String age = read(row, 2, formatter);
        String gender = read(row, 3, formatter);
        String attractionName = read(row, 4, formatter);
        String attractionContent = read(row, 5, formatter);
        String attractionType = read(row, 6, formatter);
        String visitDate = read(row, 7, formatter);
        String stayDuration = read(row, 8, formatter);
        String ticketCost = read(row, 9, formatter);
        String foodCost = read(row, 10, formatter);
        String shoppingCost = read(row, 11, formatter);
        String transportCost = read(row, 12, formatter);
        String entertainmentCost = read(row, 13, formatter);
        String totalCost = read(row, 14, formatter);
        String groupSize = read(row, 15, formatter);
        String satisfaction = read(row, 16, formatter);

        if (isEntireRowEmpty(List.of(
                touristId, userNickname, age, gender, attractionName, attractionContent, attractionType,
                visitDate, stayDuration, ticketCost, foodCost, shoppingCost, transportCost,
                entertainmentCost, totalCost, groupSize, satisfaction))) {
            return ParseRowResult.empty();
        }

        if (touristId.isBlank()) {
            return ParseRowResult.issue(new TravelAnalyticsImportIssueDto(rowNumber, "tourist_id 不能为空"));
        }

        TravelAnalyticsRecord entity = new TravelAnalyticsRecord();
        entity.setTourist_id(touristId);
        entity.setUser_nickname(userNickname);
        entity.setAge(age);
        entity.setGender(gender);
        entity.setAttraction_name(attractionName);
        entity.setAttraction_content(attractionContent);
        entity.setAttraction_type(attractionType);
        entity.setVisit_date(visitDate);
        entity.setStay_duration(stayDuration);
        entity.setTicket_cost(ticketCost);
        entity.setFood_cost(foodCost);
        entity.setShopping_cost(shoppingCost);
        entity.setTransport_cost(transportCost);
        entity.setEntertainment_cost(entertainmentCost);
        entity.setTotal_cost(totalCost);
        entity.setGroup_size(groupSize);
        entity.setSatisfaction(satisfaction);
        return ParseRowResult.entity(entity);
    }

    private String read(Row row, int cellIndex, DataFormatter formatter) {
        return normalize(formatter.formatCellValue(row.getCell(cellIndex)));
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private void applyRequest(TravelAnalyticsRecord entity, TravelAnalyticsRecordRequest request) {
        entity.setTourist_id(normalize(request.getTourist_id()));
        entity.setUser_nickname(normalize(request.getUser_nickname()));
        entity.setAge(normalize(request.getAge()));
        entity.setGender(normalize(request.getGender()));
        entity.setAttraction_name(normalize(request.getAttraction_name()));
        entity.setAttraction_content(normalize(request.getAttraction_content()));
        entity.setAttraction_type(normalize(request.getAttraction_type()));
        entity.setVisit_date(normalize(request.getVisit_date()));
        entity.setStay_duration(normalize(request.getStay_duration()));
        entity.setTicket_cost(normalize(request.getTicket_cost()));
        entity.setFood_cost(normalize(request.getFood_cost()));
        entity.setShopping_cost(normalize(request.getShopping_cost()));
        entity.setTransport_cost(normalize(request.getTransport_cost()));
        entity.setEntertainment_cost(normalize(request.getEntertainment_cost()));
        entity.setTotal_cost(normalize(request.getTotal_cost()));
        entity.setGroup_size(normalize(request.getGroup_size()));
        entity.setSatisfaction(normalize(request.getSatisfaction()));
    }

    private boolean isEntireRowEmpty(List<String> values) {
        for (String value : values) {
            if (!normalize(value).isBlank()) {
                return false;
            }
        }
        return true;
    }

    private record ParseRowResult(
            TravelAnalyticsRecord entity,
            TravelAnalyticsImportIssueDto issue,
            boolean emptyRow
    ) {
        private static ParseRowResult entity(TravelAnalyticsRecord entity) {
            return new ParseRowResult(entity, null, false);
        }

        private static ParseRowResult issue(TravelAnalyticsImportIssueDto issue) {
            return new ParseRowResult(null, issue, false);
        }

        private static ParseRowResult empty() {
            return new ParseRowResult(null, null, true);
        }
    }
}
