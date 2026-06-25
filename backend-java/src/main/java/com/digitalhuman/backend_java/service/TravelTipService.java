package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.TravelTipDto;
import com.digitalhuman.backend_java.dto.TravelTipSaveRequest;
import com.digitalhuman.backend_java.model.TravelTip;
import com.digitalhuman.backend_java.repository.TravelTipRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class TravelTipService {

    private final TravelTipRepository travelTipRepository;

    public TravelTipService(TravelTipRepository travelTipRepository) {
        this.travelTipRepository = travelTipRepository;
    }

    @Transactional
    public void seedDefaultsIfMissing() {
        if (travelTipRepository.count() > 0) {
            return;
        }
        defaultTips().forEach(travelTipRepository::save);
    }

    @Transactional(readOnly = true)
    public List<TravelTipDto> getEnabledTips() {
        return travelTipRepository.findByEnabledTrueOrderBySortOrderAsc().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TravelTipDto> getAllTips() {
        return travelTipRepository.findAllByOrderBySortOrderAsc().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public TravelTipDto getTip(String id) {
        TravelTip tip = travelTipRepository.findById(id)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "贴士不存在"));
        return toDto(tip);
    }

    @Transactional
    public TravelTipDto saveTip(TravelTipSaveRequest request) {
        String tipId = normalizeId(request.getId(), "tip");
        var existing = travelTipRepository.findById(tipId);
        TravelTip tip = existing.orElseGet(TravelTip::new);
        tip.setId(tipId);
        tip.setTitle(defaultText(request.getTitle(), "未命名贴士"));
        tip.setCategory(defaultText(request.getCategory(), "其他"));
        tip.setContent(defaultText(request.getContent(), ""));
        tip.setIcon(request.getIcon());
        tip.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        tip.setEnabled(request.getEnabled() == null || request.getEnabled());
        return toDto(travelTipRepository.save(tip));
    }

    @Transactional
    public void deleteTip(String id) {
        travelTipRepository.deleteById(id);
    }

    private TravelTipDto toDto(TravelTip tip) {
        return new TravelTipDto(
                tip.getId(),
                tip.getTitle(),
                tip.getCategory(),
                tip.getContent(),
                tip.getIcon(),
                tip.getSortOrder(),
                tip.getEnabled());
    }

    private String normalizeId(String value, String prefix) {
        if (value != null && !value.isBlank() && !value.startsWith("draft-")) {
            return value;
        }
        return prefix + "-" + UUID.randomUUID();
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private List<TravelTip> defaultTips() {
        return List.of(
                tip("tip-1", 1, "交通指南", "transport",
                        "灵山胜境位于无锡市马山半岛，可乘坐公交88路、89路、乐游2号线直达景区南门。自驾游客可导航至\"灵山胜境景区停车场\"，停车场收费合理。景区开放时间为08:00-17:30，建议上午9点前到达以避开人流高峰。", true),
                tip("tip-2", 2, "门票信息", "ticket",
                        "灵山胜境门票包含灵山大佛、灵山梵宫、九龙灌浴、祥符禅寺等核心景点。学生票、老人票有优惠，1.4米以下儿童免费。建议提前在官方渠道购票，避免现场排队。景区内有观光车可乘坐，单程票价另计。", true),
                tip("tip-3", 3, "最佳游览时间", "time",
                        "春秋两季（3-5月、9-11月）是游览灵山的最佳时节，气候宜人，景色优美。夏季注意防晒防暑，冬季注意保暖。九龙灌浴表演每天多场，建议入园时先确认当天演出时间表，合理安排行程。梵宫《吉祥颂》演出需单独预约。", true),
                tip("tip-4", 4, "必备物品", "items",
                        "建议穿着舒适的步行鞋，景区步行距离较长。夏季携带防晒霜、遮阳帽、水壶；冬季注意保暖。可携带少量零食和饮用水，景区内有素斋餐厅和便利店。拍照爱好者建议携带充电宝，景区内拍照点较多。", true),
                tip("tip-5", 5, "安全提示", "safety",
                        "登灵山大佛台阶时注意脚下安全，老人和儿童建议有人陪同。景区内水域较多，请勿靠近无护栏区域。保管好随身财物，景区人多时注意防盗。如遇身体不适，可前往游客中心医务点求助。景区内有紧急联系电话标识，请留意。", true),
                tip("tip-6", 6, "餐饮推荐", "food",
                        "灵山梵宫内设有素斋餐厅，推荐尝试灵山特色素面。景区外马山街道有多家本地餐馆，可品尝太湖湖鲜。景区内有便利店和自动售卖机，但选择有限，建议自备饮用水。梵宫素斋用餐高峰为11:30-13:00，建议错峰就餐。", true),
                tip("tip-7", 7, "注意事项", "notice",
                        "进入寺庙区域请保持安静，着装得体，避免穿拖鞋、短裤进入殿堂。拍照时请勿使用闪光灯拍摄佛像。景区内禁止吸烟，请在指定吸烟区吸烟。爱护景区环境，不要乱扔垃圾。尊重宗教信仰，参与祈福活动时遵循工作人员指引。", true)
        );
    }

    private TravelTip tip(String id, int sortOrder, String title, String category,
                          String content, boolean enabled) {
        TravelTip tip = new TravelTip();
        tip.setId(id);
        tip.setSortOrder(sortOrder);
        tip.setTitle(title);
        tip.setCategory(category);
        tip.setContent(content);
        tip.setEnabled(enabled);
        return tip;
    }
}
