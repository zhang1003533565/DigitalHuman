package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.FacilityCategory;
import com.digitalhuman.backend_java.model.ScenicFacility;
import com.digitalhuman.backend_java.model.ScenicFacilityDetail;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ScenicKnowledgeDocumentRendererTests {

    @Test
    void renderUsesOnlyOfficialPublicFieldsInDeterministicOrder() {
        ScenicKnowledgeDocumentRenderer renderer = new ScenicKnowledgeDocumentRenderer();
        ScenicFacility facility = facility();
        ScenicFacilityDetail detail = detail();

        ScenicKnowledgeDocumentRenderer.RenderedDocument rendered = renderer.render(facility, detail);

        String expectedMarkdown = """
                # 灵山大佛
                
                - 景点 ID：12
                - 景点编码：LS-001
                - 分类：佛教景观
                - 位置：无锡灵山胜境景区核心区
                - 地图坐标：120.1234567, 31.1234567
                - 开放时间：08:30 - 17:00
                - 内容版本：7
                
                ## 简介
                
                太湖之滨的文化地标
                
                ## 建筑景观参数
                
                通高八十八米，青铜立像
                
                ## 核心功能
                
                佛教文化展示与朝圣体验
                
                ## 文化内涵
                
                体现佛教文化与青铜艺术传承
                
                ## 详细介绍
                
                灵山大佛是景区的核心文化景观，承载祈福与文化展示功能。
                
                ## 游玩亮点
                
                登云道远眺太湖，夜间灯光秀
                
                ## 演艺与开放信息
                
                每日 09:00 有吉祥颂演出
                
                ## 游客须知
                
                请文明参观，保持安静
                
                ## 备注
                
                正式景点资料版本
                """;

        assertEquals("scenic-facility-12.md", rendered.fileName());
        assertEquals(expectedMarkdown, rendered.markdown());
        assertEquals(7, rendered.contentVersion());
        assertEquals(sha256(expectedMarkdown), rendered.sha256());
        assertTrue(rendered.markdown().contains("## 文化内涵"));
        assertTrue(rendered.markdown().contains(detail.getCulturalConnotation()));
        assertFalse(rendered.markdown().contains("camera_stream_key"));
        assertFalse(rendered.markdown().contains("tourist_id"));
        assertFalse(rendered.markdown().contains("live_stream_url"));
    }

    @Test
    void renderSkipsBlankSectionsAndDefaultsVersionToOne() {
        ScenicKnowledgeDocumentRenderer renderer = new ScenicKnowledgeDocumentRenderer();
        ScenicFacility facility = facility();
        ScenicFacilityDetail detail = new ScenicFacilityDetail();
        detail.setContentVersion(null);
        detail.setCulturalConnotation(" ");
        detail.setDetailedIntroduction(null);
        detail.setHighlights("");
        detail.setPerformanceOpenInfo(null);
        detail.setVisitorNotes("   ");
        detail.setRemark(null);

        ScenicKnowledgeDocumentRenderer.RenderedDocument rendered = renderer.render(facility, detail);

        assertEquals(1, rendered.contentVersion());
        assertFalse(rendered.markdown().contains("## 文化内涵"));
        assertFalse(rendered.markdown().contains("## 详细介绍"));
        assertFalse(rendered.markdown().contains("## 游玩亮点"));
        assertFalse(rendered.markdown().contains("## 演艺与开放信息"));
        assertFalse(rendered.markdown().contains("## 游客须知"));
        assertFalse(rendered.markdown().contains("## 备注"));
    }

    private ScenicFacility facility() {
        ScenicFacility facility = new ScenicFacility();
        facility.setId(12L);
        facility.setSpotCode("LS-001");
        facility.setName("灵山大佛");
        facility.setShortDescription("太湖之滨的文化地标");
        facility.setLocationDescription("无锡灵山胜境景区核心区");
        facility.setLongitude(new BigDecimal("120.1234567"));
        facility.setLatitude(new BigDecimal("31.1234567"));
        facility.setOpenTime(LocalTime.of(8, 30));
        facility.setCloseTime(LocalTime.of(17, 0));
        FacilityCategory category = new FacilityCategory();
        category.setId(5L);
        category.setName("佛教景观");
        facility.setCategory(category);
        return facility;
    }

    private ScenicFacilityDetail detail() {
        ScenicFacilityDetail detail = new ScenicFacilityDetail();
        detail.setArchitectureLandscapeParams("通高八十八米，青铜立像");
        detail.setCoreFunction("佛教文化展示与朝圣体验");
        detail.setCulturalConnotation("体现佛教文化与青铜艺术传承");
        detail.setDetailedIntroduction("灵山大佛是景区的核心文化景观，承载祈福与文化展示功能。");
        detail.setHighlights("登云道远眺太湖，夜间灯光秀");
        detail.setPerformanceOpenInfo("每日 09:00 有吉祥颂演出");
        detail.setVisitorNotes("请文明参观，保持安静");
        detail.setRemark("正式景点资料版本");
        detail.setContentVersion(7);
        return detail;
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte item : digest) {
                builder.append(String.format("%02x", item));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
