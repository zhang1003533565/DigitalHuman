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
                        "大境门景区位于张家口市桥西区，可乘坐公交16路、32路直达大境门站点。自驾游客可导航至“大境门景区停车场”，停车方便。景区开放时间为08:00-18:00。", true),
                tip("tip-2", 2, "门票信息", "ticket",
                        "大境门街区免费开放；登长城需要购票，学生票、老人票有优惠，1.4米以下儿童免票。建议提前在官方渠道查询票价，避开节假日现场排队。景区内长城步道可步行游览。", true),
                tip("tip-3", 3, "最佳游览时间", "time",
                        "春秋两季（4-5月、9-10月）是游览大境门的最佳时节，气温舒适，适合徒步长城。夏季风大注意防晒；冬季寒冷，建议做好保暖。傍晚时分城墙灯光亮起，拍照出片，可合理安排行程。", true),
                tip("tip-4", 4, "必备物品", "items",
                        "建议穿着舒适防滑的步行鞋，长城台阶较多。夏季携带防晒霜、遮阳帽、饮用水；冬季注意保暖。可携带少量零食，街区内有小吃店和文创商铺，喜欢拍照可带上相机。", true),
                tip("tip-5", 5, "安全提示", "safety",
                        "攀登长城台阶时注意脚下安全，老人和儿童建议有人陪同。长城部分路段坡度较大，不要翻越护栏。如果身体不适，可前往游客中心医务点求助。景区内设有紧急联系电话标识，请留意。", true),
                tip("tip-6", 6, "餐饮推荐", "food",
                        "大境门古街内有多家本地餐馆，推荐品尝张家口特色：莜面、熏肉、黄米糕。街区还有小吃铺、便利店，可自由选择。建议错峰就餐，用餐高峰多在11:30-13:00。", true),
                tip("tip-7", 7, "注意事项", "notice",
                        "进入长城区域请勿刻画墙砖，爱护文物古迹。请勿攀爬未开放野长城。拍照时不要踩踏墙体。景区内禁止烟火，爱护环境不乱扔垃圾，文明游览。", true)
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
