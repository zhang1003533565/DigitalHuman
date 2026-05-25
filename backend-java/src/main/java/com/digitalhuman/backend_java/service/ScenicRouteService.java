package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ScenicRouteDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto.CoordinateDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto.RouteFacilityDto;
import com.digitalhuman.backend_java.dto.ScenicRouteDto.RouteNodeDto;
import com.digitalhuman.backend_java.dto.ScenicRouteSaveRequest;
import com.digitalhuman.backend_java.model.ScenicRoute;
import com.digitalhuman.backend_java.model.ScenicRouteFacility;
import com.digitalhuman.backend_java.model.ScenicRouteNode;
import com.digitalhuman.backend_java.repository.ScenicRouteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
public class ScenicRouteService {

    private final ScenicRouteRepository routeRepository;

    public ScenicRouteService(ScenicRouteRepository routeRepository) {
        this.routeRepository = routeRepository;
    }

    @Transactional
    public void seedDefaultsIfMissing() {
        if (routeRepository.count() > 0) {
            return;
        }

        defaultRoutes().forEach(routeRepository::save);
    }

    @Transactional(readOnly = true)
    public List<ScenicRouteDto> recommendRoutes(String interest) {
        return routeRepository.findByEnabledTrueOrderBySortOrderAsc().stream()
                .filter(route -> interest == null || interest.isBlank() || route.getSuitableFor().contains(interest))
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ScenicRouteDto> getAllRoutes() {
        return routeRepository.findAllByOrderBySortOrderAsc().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public ScenicRouteDto saveRoute(ScenicRouteSaveRequest request) {
        String routeId = normalizeId(request.getId(), "route");
        var existingRoute = routeRepository.findById(routeId);
        ScenicRoute route = existingRoute.orElseGet(ScenicRoute::new);
        route.setId(routeId);
        route.setName(defaultText(request.getName(), "未命名路线"));
        route.setSuitableFor(defaultText(request.getSuitableFor(), "综合推荐"));
        route.setDuration(defaultText(request.getDuration(), "待配置"));
        route.setDistance(defaultText(request.getDistance(), ""));
        route.setIntensity(defaultText(request.getIntensity(), ""));
        route.setBestTime(defaultText(request.getBestTime(), ""));
        route.setReason(defaultText(request.getReason(), ""));
        route.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        route.setEnabled(request.getEnabled() == null || request.getEnabled());
        route.setTagsCsv(String.join(",", request.getTags() == null ? List.of() : request.getTags()));

        route.getNodes().clear();
        route.getFacilities().clear();
        if (existingRoute.isPresent()) {
            routeRepository.flush();
        }

        List<ScenicRouteSaveRequest.RouteNodeRequest> nodeRequests = request.getNodes() == null ? List.of() : request.getNodes();
        for (int i = 0; i < nodeRequests.size(); i++) {
            ScenicRouteSaveRequest.RouteNodeRequest nodeRequest = nodeRequests.get(i);
            ScenicRouteNode node = new ScenicRouteNode();
            node.setId(normalizeId(nodeRequest.getId(), routeId + "-node"));
            node.setRoute(route);
            node.setSortOrder(i + 1);
            node.setName(defaultText(nodeRequest.getName(), "未命名节点"));
            node.setType(defaultText(nodeRequest.getType(), "spot"));
            node.setSpotRefId(nodeRequest.getSpotRefId());
            node.setStay(defaultText(nodeRequest.getStay(), ""));
            node.setSummary(defaultText(nodeRequest.getSummary(), ""));
            node.setRequiredNode(nodeRequest.getRequired() == null || nodeRequest.getRequired());
            node.setLongitude(resolveLongitude(nodeRequest.getCoordinate()));
            node.setLatitude(resolveLatitude(nodeRequest.getCoordinate()));
            route.getNodes().add(node);
        }

        List<ScenicRouteSaveRequest.RouteFacilityRequest> facilityRequests = request.getFacilities() == null ? List.of() : request.getFacilities();
        for (int i = 0; i < facilityRequests.size(); i++) {
            ScenicRouteSaveRequest.RouteFacilityRequest facilityRequest = facilityRequests.get(i);
            ScenicRouteFacility facility = new ScenicRouteFacility();
            facility.setId(normalizeId(facilityRequest.getId(), routeId + "-facility"));
            facility.setRoute(route);
            facility.setSortOrder(i + 1);
            facility.setName(defaultText(facilityRequest.getName(), "未命名设施"));
            facility.setLinkedFacilityId(facilityRequest.getLinkedFacilityId());
            facility.setCategory(defaultText(facilityRequest.getCategory(), "service"));
            facility.setNearNode(defaultText(facilityRequest.getNearNode(), ""));
            facility.setNearNodeId(facilityRequest.getNearNodeId());
            facility.setDistance(defaultText(facilityRequest.getDistance(), ""));
            facility.setLongitude(resolveLongitude(facilityRequest.getCoordinate()));
            facility.setLatitude(resolveLatitude(facilityRequest.getCoordinate()));
            route.getFacilities().add(facility);
        }

        return toDto(routeRepository.save(route));
    }

    @Transactional
    public void deleteRoute(String id) {
        routeRepository.deleteById(id);
    }

    private ScenicRouteDto toDto(ScenicRoute route) {
        List<RouteNodeDto> nodes = route.getNodes().stream()
                .map(node -> new RouteNodeDto(
                        node.getId(),
                        node.getName(),
                        node.getType(),
                        node.getSpotRefId(),
                        node.getStay(),
                        node.getSummary(),
                        Boolean.TRUE.equals(node.getRequiredNode()),
                        new CoordinateDto(node.getLongitude(), node.getLatitude())))
                .toList();
        List<RouteFacilityDto> facilities = route.getFacilities().stream()
                .map(facility -> new RouteFacilityDto(
                        facility.getId(),
                        facility.getName(),
                        facility.getLinkedFacilityId(),
                        facility.getCategory(),
                        facility.getNearNode(),
                        facility.getNearNodeId(),
                        facility.getDistance(),
                        new CoordinateDto(facility.getLongitude(), facility.getLatitude())))
                .toList();

        return new ScenicRouteDto(
                route.getId(),
                route.getName(),
                route.getSuitableFor(),
                route.getDuration(),
                route.getDistance(),
                route.getIntensity(),
                route.getReason(),
                route.getBestTime(),
                route.getSortOrder(),
                Boolean.TRUE.equals(route.getEnabled()),
                splitTags(route.getTagsCsv()),
                nodes.stream().map(RouteNodeDto::getName).toList(),
                nodes,
                facilities,
                nodes.stream().map(RouteNodeDto::getCoordinate).toList());
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

    private double resolveLongitude(ScenicRouteSaveRequest.CoordinateRequest coordinate) {
        return coordinate == null || coordinate.getLongitude() == null ? 120.1009 : coordinate.getLongitude();
    }

    private double resolveLatitude(ScenicRouteSaveRequest.CoordinateRequest coordinate) {
        return coordinate == null || coordinate.getLatitude() == null ? 31.4259 : coordinate.getLatitude();
    }

    private List<String> splitTags(String tagsCsv) {
        if (tagsCsv == null || tagsCsv.isBlank()) {
            return List.of();
        }
        return Arrays.stream(tagsCsv.split(","))
                .map(String::trim)
                .filter(tag -> !tag.isBlank())
                .toList();
    }

    private List<ScenicRoute> defaultRoutes() {
        return List.of(
                route(
                        "route-1",
                        1,
                        "历史文化爱好者路线",
                        "历史文化",
                        "6小时",
                        "约3.8公里",
                        "深度步行",
                        "09:00前入园，预留梵宫《吉祥颂》演出时间",
                        "历史文化,深度讲解,首次来访,祈福礼佛",
                        "适合首次深度了解灵山佛教文化脉络的游客，覆盖祥符禅寺、灵山大佛、梵宫和五印坛城等核心文化节点。",
                        List.of(
                                node("node-101", 1, "南门入园", "entrance", "5分钟", "从南门进入，完成检票与路线确认。", true, 120.10010, 31.42190),
                                node("node-102", 2, "灵山大照壁", "spot", "15分钟", "华夏第一壁，适合讲解灵山胜境整体文化意象。", true, 120.10042, 31.42305),
                                node("node-103", 3, "佛手广场", "spot", "20分钟", "触摸天下第一掌，体验祈福文化。", true, 120.10082, 31.42410),
                                node("node-104", 4, "祥符禅寺", "spot", "35分钟", "千年古刹，重点讲玄奘、小灵山与古井银杏。", true, 120.10136, 31.42518),
                                node("node-105", 5, "灵山大佛", "spot", "60分钟", "登云道、抱佛脚与太湖视野，是路线核心。", true, 120.10105, 31.42738),
                                node("node-106", 6, "灵山梵宫", "spot", "75分钟", "佛教艺术殿堂，推荐结合《吉祥颂》演出。", true, 120.10292, 31.42635),
                                node("node-107", 7, "五印坛城", "spot", "40分钟", "体验藏传佛教建筑、转经筒和坛城文化。", true, 120.10355, 31.42528),
                                node("node-108", 8, "三圣殿", "spot", "25分钟", "作为文化收束节点，适合回顾佛教历史脉络。", false, 120.10218, 31.42455)
                        ),
                        List.of(
                                facility("facility-101", 1, "游客中心", "service", "南门入园", "约120米", 120.09986, 31.42172),
                                facility("facility-102", 2, "梵宫素斋", "food", "灵山梵宫", "约80米", 120.10318, 31.42608),
                                facility("facility-103", 3, "五印坛城卫生间", "wc", "五印坛城", "约60米", 120.10378, 31.42502),
                                facility("facility-104", 4, "观光车梵宫站", "transport", "灵山梵宫", "约90米", 120.10252, 31.42602)
                        )),
                route(
                        "route-2",
                        2,
                        "自然风光爱好者路线",
                        "自然风光",
                        "5小时",
                        "约3.2公里",
                        "舒缓步行",
                        "上午观看九龙灌浴，下午在大佛平台看太湖光影",
                        "自然风光,拍照,轻松游,太湖视野",
                        "适合偏爱太湖风光、园林景观和轻松节奏的游客，兼顾九龙灌浴、大佛平台和禅意园林。",
                        List.of(
                                node("node-201", 1, "南门入园", "entrance", "5分钟", "从南门进入，优先确认九龙灌浴表演时间。", true, 120.10010, 31.42190),
                                node("node-202", 2, "佛足坛", "spot", "15分钟", "从佛足坛开启自然与佛教意象结合的游览。", true, 120.10052, 31.42352),
                                node("node-203", 3, "九龙灌浴", "show", "30分钟", "观看动态表演，适合拍摄水幕与佛光。", true, 120.10105, 31.42434),
                                node("node-204", 4, "菩提大道", "spot", "35分钟", "沿路欣赏植物景观与太湖方向视野。", true, 120.10128, 31.42542),
                                node("node-205", 5, "灵山大佛", "spot", "55分钟", "登高俯瞰太湖和马山半岛。", true, 120.10105, 31.42738),
                                node("node-206", 6, "曼飞龙塔", "spot", "25分钟", "傣族佛教建筑风格，适合园林拍照。", false, 120.10235, 31.42588),
                                node("node-207", 7, "灵山精舍", "food", "45分钟", "品素斋、体验禅意园林的安静氛围。", false, 120.10418, 31.42565),
                                node("node-208", 8, "梵宫广场", "spot", "20分钟", "以开阔广场作为路线收束，方便前往出口。", true, 120.10292, 31.42635)
                        ),
                        List.of(
                                facility("facility-201", 1, "菩提大道卫生间", "wc", "菩提大道", "约70米", 120.10155, 31.42510),
                                facility("facility-202", 2, "灵山精舍素斋", "food", "灵山精舍", "约0米", 120.10418, 31.42565),
                                facility("facility-203", 3, "观景平台休息点", "service", "灵山大佛", "约100米", 120.10130, 31.42705),
                                facility("facility-204", 4, "观光车大佛站", "transport", "灵山大佛", "约110米", 120.10075, 31.42695)
                        )),
                route(
                        "route-3",
                        3,
                        "亲子家庭路线",
                        "亲子家庭",
                        "4小时",
                        "约2.4公里",
                        "轻松少走",
                        "10:00-15:00，避开午后暴晒并匹配演出场次",
                        "亲子家庭,互动体验,少走路,演出优先",
                        "适合带孩子和老人游览，减少长距离攀爬，把动态演出、祈福互动和直观艺术体验串联起来。",
                        List.of(
                                node("node-301", 1, "南门入园", "entrance", "5分钟", "确认儿童与老人优惠票、观光车需求。", true, 120.10010, 31.42190),
                                node("node-302", 2, "九龙灌浴", "show", "30分钟", "用故事化语言介绍佛陀诞生，孩子更容易理解。", true, 120.10105, 31.42434),
                                node("node-303", 3, "佛手广场", "spot", "20分钟", "摸天下第一掌，完成轻量祈福互动。", true, 120.10082, 31.42410),
                                node("node-304", 4, "百子戏弥勒", "spot", "25分钟", "雕塑互动和拍照，氛围轻松。", true, 120.10162, 31.42460),
                                node("node-305", 5, "灵山梵宫", "spot", "55分钟", "看色彩、穹顶和演出，降低专业术语。", true, 120.10292, 31.42635),
                                node("node-306", 6, "五印坛城", "spot", "30分钟", "体验转经筒和藏式建筑，适合亲子观察。", false, 120.10355, 31.42528)
                        ),
                        List.of(
                                facility("facility-301", 1, "亲子卫生间", "wc", "九龙灌浴", "约80米", 120.10075, 31.42402),
                                facility("facility-302", 2, "素面餐厅", "food", "灵山梵宫", "约120米", 120.10272, 31.42608),
                                facility("facility-303", 3, "医务点", "medical", "佛手广场", "约160米", 120.10052, 31.42388),
                                facility("facility-304", 4, "观光车亲子上车点", "transport", "百子戏弥勒", "约90米", 120.10182, 31.42432)
                        ))
        );
    }

    private ScenicRoute route(
            String id,
            int sortOrder,
            String name,
            String suitableFor,
            String duration,
            String distance,
            String intensity,
            String bestTime,
            String tagsCsv,
            String reason,
            List<ScenicRouteNode> nodes,
            List<ScenicRouteFacility> facilities) {
        ScenicRoute route = new ScenicRoute();
        route.setId(id);
        route.setSortOrder(sortOrder);
        route.setName(name);
        route.setSuitableFor(suitableFor);
        route.setDuration(duration);
        route.setDistance(distance);
        route.setIntensity(intensity);
        route.setBestTime(bestTime);
        route.setTagsCsv(tagsCsv);
        route.setReason(reason);
        nodes.forEach(node -> node.setRoute(route));
        facilities.forEach(facility -> facility.setRoute(route));
        route.setNodes(nodes);
        route.setFacilities(facilities);
        return route;
    }

    private ScenicRouteNode node(
            String id,
            int sortOrder,
            String name,
            String type,
            String stay,
            String summary,
            boolean required,
            double longitude,
            double latitude) {
        ScenicRouteNode node = new ScenicRouteNode();
        node.setId(id);
        node.setSortOrder(sortOrder);
        node.setName(name);
        node.setType(type);
        node.setStay(stay);
        node.setSummary(summary);
        node.setRequiredNode(required);
        node.setLongitude(longitude);
        node.setLatitude(latitude);
        return node;
    }

    private ScenicRouteFacility facility(
            String id,
            int sortOrder,
            String name,
            String category,
            String nearNode,
            String distance,
            double longitude,
            double latitude) {
        ScenicRouteFacility facility = new ScenicRouteFacility();
        facility.setId(id);
        facility.setSortOrder(sortOrder);
        facility.setName(name);
        facility.setCategory(category);
        facility.setNearNode(nearNode);
        facility.setDistance(distance);
        facility.setLongitude(longitude);
        facility.setLatitude(latitude);
        return facility;
    }
}
