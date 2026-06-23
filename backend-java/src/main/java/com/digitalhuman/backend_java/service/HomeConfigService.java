package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.HomeConfig;
import com.digitalhuman.backend_java.model.HomeConfigType;
import com.digitalhuman.backend_java.repository.HomeConfigRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class HomeConfigService {

    private final HomeConfigRepository repository;

    public HomeConfigService(HomeConfigRepository repository) {
        this.repository = repository;
    }

    public List<HomeConfig> listByType(HomeConfigType type) {
        return repository.findByTypeOrderBySortOrderAsc(type);
    }

    public List<HomeConfig> listEnabledByType(HomeConfigType type) {
        return repository.findByTypeAndEnabledTrueOrderBySortOrderAsc(type);
    }

    public List<HomeConfig> listAllEnabled() {
        return repository.findByEnabledTrueOrderByTypeAscSortOrderAsc();
    }

    public List<HomeConfig> listAll() {
        return repository.findAll();
    }

    public HomeConfig save(HomeConfig config) {
        if (config.getId() == null || config.getId().isBlank()) {
            config.setId(UUID.randomUUID().toString());
            config.setCreatedAt(LocalDateTime.now());
        }
        return repository.save(config);
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    public HomeConfig toggleEnabled(String id, boolean enabled) {
        HomeConfig config = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("HomeConfig not found: " + id));
        config.setEnabled(enabled);
        return repository.save(config);
    }

    public void seedDefaultsIfMissing() {
        if (repository.count() > 0) {
            return;
        }
        // 轮播图
        save(build(HomeConfigType.BANNER, "灵山大佛春季特惠",
                "https://picsum.photos/seed/banner1/800/300",
                "春季游览灵山大佛，享受8折优惠", 0));
        save(build(HomeConfigType.BANNER, "五印坛城文化体验",
                "https://picsum.photos/seed/banner2/800/300",
                "探索藏传佛教文化的神圣殿堂", 1));
        // 广告位
        save(build(HomeConfigType.AD, "梵宫演出预约",
                "https://picsum.photos/seed/ad1/200/150",
                "今日演出场次: 10:00 / 14:00 / 16:00", 0));
        save(build(HomeConfigType.AD, "景区餐饮优惠",
                "https://picsum.photos/seed/ad2/200/150",
                "素斋体验套餐仅靨68元/位", 1));
        // 今日景点推荐
        save(build(HomeConfigType.SPOT_RECOMMEND, "灵山大佛",
                "https://picsum.photos/seed/spot1/400/250",
                "高88米的青铜释迦牟尼佛立像，为世界著名景点", 0));
        save(build(HomeConfigType.SPOT_RECOMMEND, "五印坛城",
                "https://picsum.photos/seed/spot2/400/250",
                "仿照藏传佛教坛城建造的佛教建筑", 1));
        // 今日路线推荐
        save(build(HomeConfigType.ROUTE_RECOMMEND, "经典半日游",
                "https://picsum.photos/seed/route1/400/250",
                "灵山大佛 → 九龙灌浴 → 梵宫 → 五印坛城", 0));
        save(build(HomeConfigType.ROUTE_RECOMMEND, "文化深度游",
                "https://picsum.photos/seed/route2/400/250",
                "适合对佛教文化感兴趣的游客，全程约5小时", 1));
    }

    private HomeConfig build(HomeConfigType type, String title, String imageUrl, String description, int order) {
        HomeConfig c = new HomeConfig();
        c.setType(type);
        c.setTitle(title);
        c.setImageUrl(imageUrl);
        c.setDescription(description);
        c.setSortOrder(order);
        c.setEnabled(true);
        return c;
    }
}
