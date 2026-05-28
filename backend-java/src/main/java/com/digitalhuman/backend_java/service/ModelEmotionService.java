package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.dto.ActionMatchRequest;
import com.digitalhuman.backend_java.dto.ActionMatchResponse;
import com.digitalhuman.backend_java.dto.ActionTriggerConfigDto;
import com.digitalhuman.backend_java.dto.ActionTriggerRuleDto;
import com.digitalhuman.backend_java.model.ActionTriggerRule;
import com.digitalhuman.backend_java.model.DigitalHumanModel;
import com.digitalhuman.backend_java.model.ModelAction;
import com.digitalhuman.backend_java.repository.ActionTriggerRuleRepository;
import com.digitalhuman.backend_java.repository.DigitalHumanModelRepository;
import com.digitalhuman.backend_java.repository.ModelActionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class ModelEmotionService {

    private static final Path LIVE2D_ROOT = resolveLive2dRoot();
    private static final Pattern ACTION_TABLE_PATTERN = Pattern.compile(
            "\\|\\s*([^|]+?)\\s*\\|\\s*`([^`]+)`\\s*\\|\\s*(\\d+)\\s*\\|\\s*`([^`]+)`\\s*\\|"
    );
    private static final Set<String> RULE_TYPES = Set.of("MOUSE", "KEYWORD", "IDLE");
    private static final Set<String> MOUSE_EVENT_CODES = Set.of(
            "CLICK_LEFT",
            "DOUBLE_CLICK_LEFT",
            "RIGHT_CLICK",
            "SLIDE_LEFT",
            "SLIDE_RIGHT",
            "WHEEL_UP"
    );
    private static final int HIGHEST_PRIORITY = 1;
    private static final int LOWEST_PRIORITY = 10;

    private final DigitalHumanModelRepository modelRepository;
    private final ModelActionRepository actionRepository;
    private final ActionTriggerRuleRepository actionTriggerRuleRepository;
    private final ObjectMapper objectMapper;

    public ModelEmotionService(
            DigitalHumanModelRepository modelRepository,
            ModelActionRepository actionRepository,
            ActionTriggerRuleRepository actionTriggerRuleRepository,
            ObjectMapper objectMapper) {
        this.modelRepository = modelRepository;
        this.actionRepository = actionRepository;
        this.actionTriggerRuleRepository = actionTriggerRuleRepository;
        this.objectMapper = objectMapper;
    }

    private static Path resolveLive2dRoot() {
        Path current = Path.of("").toAbsolutePath().normalize();
        List<Path> candidates = new ArrayList<>();
        candidates.add(current.resolve("frontend-visitor").resolve("public").resolve("live2d"));

        Path parent = current.getParent();
        if (parent != null) {
            candidates.add(parent.resolve("frontend-visitor").resolve("public").resolve("live2d"));
        }

        return candidates.stream()
                .filter(Files::isDirectory)
                .findFirst()
                .orElse(candidates.get(0));
    }

    @Transactional
    public List<Map<String, Object>> scanModels() throws IOException {
        if (!Files.isDirectory(LIVE2D_ROOT)) {
            throw new IOException("Live2D 鐩綍涓嶅瓨鍦? " + LIVE2D_ROOT);
        }

        List<Map<String, Object>> scannedModels = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(LIVE2D_ROOT)) {
            for (Path modelDir : stream) {
                if (!Files.isDirectory(modelDir)) {
                    continue;
                }

                DigitalHumanModel model = scanModelDirectory(modelDir);
                if (model != null) {
                    scannedModels.add(toModelDto(model));
                }
            }
        }

        return scannedModels;
    }

    private DigitalHumanModel scanModelDirectory(Path modelDir) throws IOException {
        String modelKey = modelDir.getFileName().toString();
        Path actionMdPath = modelDir.resolve("action.md");
        if (!Files.exists(actionMdPath)) {
            return null;
        }

        String modelPath = findModelJson(modelDir);
        if (modelPath == null) {
            return null;
        }

        String displayName = extractModelDisplayName(actionMdPath, modelKey);
        DigitalHumanModel model = modelRepository.findByModelKey(modelKey)
                .orElseGet(() -> {
                    DigitalHumanModel newModel = new DigitalHumanModel();
                    newModel.setModelKey(modelKey);
                    newModel.setStatus("active");
                    return newModel;
                });

        model.setDisplayName(displayName);
        model.setModelPath(modelPath);
        model.setActionMdPath(actionMdPath.toString());
        model = modelRepository.save(model);

        syncActions(model, parseActionMd(model, actionMdPath));
        return model;
    }

    private String extractModelDisplayName(Path actionMdPath, String fallback) {
        try (Stream<String> lines = Files.lines(actionMdPath)) {
            return lines
                    .map(String::trim)
                    .filter(line -> line.startsWith("#"))
                    .map(line -> line.replaceFirst("^#+\\s*", "").trim())
                    .map(line -> line.replaceFirst("鍔ㄤ綔鍛藉悕瀵圭収$", "").trim())
                    .filter(line -> !line.isBlank())
                    .findFirst()
                    .orElse(fallback);
        } catch (IOException exception) {
            return fallback;
        }
    }

    private void syncActions(DigitalHumanModel model, List<ModelAction> parsedActions) {
        Map<String, ModelAction> existingByKey = actionRepository.findByModelId(model.getId()).stream()
                .collect(Collectors.toMap(ModelAction::getActionKey, action -> action));

        List<ModelAction> actionsToSave = new ArrayList<>();
        for (ModelAction parsedAction : parsedActions) {
            ModelAction action = existingByKey.remove(parsedAction.getActionKey());
            if (action == null) {
                action = parsedAction;
            } else {
                action.setActionName(parsedAction.getActionName());
                action.setGroupName(parsedAction.getGroupName());
                action.setActionIndex(parsedAction.getActionIndex());
                action.setMotionFilePath(parsedAction.getMotionFilePath());
            }
            actionsToSave.add(action);
        }

        actionRepository.saveAll(actionsToSave);

        for (ModelAction staleAction : existingByKey.values()) {
            actionTriggerRuleRepository.deleteByModelActionId(staleAction.getId());
            actionRepository.delete(staleAction);
        }
    }

    private String findModelJson(Path modelDir) {
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(modelDir, "*.model3.json")) {
            for (Path file : stream) {
                return modelDir.getFileName() + "/" + file.getFileName();
            }
        } catch (IOException ignored) {
            return null;
        }
        return null;
    }

    private List<ModelAction> parseActionMd(DigitalHumanModel model, Path actionMdPath) throws IOException {
        String content = Files.readString(actionMdPath);
        List<ModelAction> actions = new ArrayList<>();
        Set<String> seenKeys = new HashSet<>();

        Matcher matcher = ACTION_TABLE_PATTERN.matcher(content);
        while (matcher.find()) {
            String actionName = matcher.group(1).trim();
            String groupName = normalizeGroupName(matcher.group(2).trim());
            int actionIndex = Integer.parseInt(matcher.group(3).trim());
            String motionFile = matcher.group(4).trim();
            String actionKey = groupName + "-" + actionName;

            if (!seenKeys.add(actionKey)) {
                continue;
            }

            ModelAction action = new ModelAction();
            action.setModel(model);
            action.setActionName(actionName);
            action.setActionKey(actionKey);
            action.setGroupName(groupName);
            action.setActionIndex(actionIndex);
            action.setMotionFilePath(motionFile);
            action.setEnabled(false);
            actions.add(action);
        }

        return actions;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getModels() {
        return modelRepository.findAll().stream()
                .map(this::toModelDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUserModelConfigs() {
        return modelRepository.findAll().stream()
                .filter(model -> !"disabled".equalsIgnoreCase(model.getStatus()))
                .map(model -> {
                    Map<String, Object> dto = new LinkedHashMap<>(toModelDto(model));
                    dto.put("enabledActions", actionRepository.findByModelIdAndEnabledTrue(model.getId()).stream()
                            .map(this::toActionDto)
                            .toList());
                    dto.put("triggerRules", actionTriggerRuleRepository.findByModelIdAndEnabledTrueOrderByPriorityAscIdAsc(model.getId()).stream()
                            .filter(rule -> RULE_TYPES.contains(rule.getRuleType()))
                            .map(this::toActionTriggerRuleDto)
                            .toList());
                    return dto;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getModelDetail(Long modelId) {
        DigitalHumanModel model = modelRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("妯″瀷涓嶅瓨鍦? " + modelId));

        List<ModelAction> allActions = actionRepository.findByModelId(modelId);
        List<ModelAction> enabledActions = actionRepository.findByModelIdAndEnabledTrue(modelId);

        Map<String, Object> result = new LinkedHashMap<>(toModelDto(model));
        result.put("allActions", allActions.stream().map(this::toActionDto).toList());
        result.put("enabledActions", enabledActions.stream().map(this::toActionDto).toList());
        return result;
    }

    @Transactional
    public List<Map<String, Object>> updateModelActions(Long modelId, List<Long> enabledActionIds) {
        Set<Long> enabledIds = enabledActionIds == null ? Set.of() : new HashSet<>(enabledActionIds);
        List<ModelAction> actions = actionRepository.findByModelId(modelId);
        for (ModelAction action : actions) {
            action.setEnabled(enabledIds.contains(action.getId()));
        }
        return actionRepository.saveAll(actions).stream()
                .map(this::toActionDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getModelEnabledActions(Long modelId) {
        return actionRepository.findByModelIdAndEnabledTrue(modelId).stream()
                .map(this::toActionDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public ActionTriggerConfigDto getTriggerConfig(Long modelId) {
        DigitalHumanModel model = modelRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + modelId));
        List<ActionTriggerRuleDto> rules = actionTriggerRuleRepository.findByModelIdOrderByPriorityAscIdAsc(modelId).stream()
                .map(this::toActionTriggerRuleDto)
                .toList();

        ActionTriggerConfigDto dto = new ActionTriggerConfigDto();
        dto.setModel(toModelDto(model));
        dto.setActions(actionRepository.findByModelId(modelId).stream()
                .map(this::toActionDto)
                .toList());
        dto.setMouseRules(rules.stream()
                .filter(rule -> "MOUSE".equals(rule.getRuleType()))
                .toList());
        dto.setTextRules(rules.stream()
                .filter(rule -> "KEYWORD".equals(rule.getRuleType()))
                .toList());
        dto.setIdleRules(rules.stream()
                .filter(rule -> "IDLE".equals(rule.getRuleType()))
                .toList());
        return dto;
    }

    @Transactional
    public ActionTriggerConfigDto saveTriggerConfig(Long modelId, ActionTriggerConfigDto request) {
        DigitalHumanModel model = modelRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + modelId));

        actionTriggerRuleRepository.deleteByModelId(modelId);
        List<ActionTriggerRuleDto> incoming = new ArrayList<>();
        if (request != null) {
            incoming.addAll(request.getMouseRules());
            incoming.addAll(request.getTextRules());
            incoming.addAll(request.getIdleRules());
        }

        List<ActionTriggerRule> rules = incoming.stream()
                .map(ruleDto -> toActionTriggerRule(model, ruleDto))
                .toList();
        actionTriggerRuleRepository.saveAll(rules);
        return getTriggerConfig(modelId);
    }

    @Transactional(readOnly = true)
    public ActionMatchResponse matchAction(ActionMatchRequest request) {
        if (request == null || stringValue(request.getModelKey()).isBlank()) {
            return ActionMatchResponse.empty();
        }

        DigitalHumanModel model = modelRepository.findByModelKey(request.getModelKey())
                .orElse(null);
        if (model == null) {
            return ActionMatchResponse.empty();
        }

        String eventCode = stringValue(request.getEventCode());
        String text = stringValue(request.getText());
        List<ActionTriggerRule> matchedRules = actionTriggerRuleRepository.findByModelIdAndEnabledTrueOrderByPriorityAscIdAsc(model.getId()).stream()
                .filter(rule -> ruleMatches(rule, eventCode, text))
                .toList();

        if (matchedRules.isEmpty()) {
            return ActionMatchResponse.empty();
        }

        return toActionMatchResponse(selectWeightedRule(matchedRules));
    }

    private ActionTriggerRule toActionTriggerRule(DigitalHumanModel model, ActionTriggerRuleDto dto) {
        if (dto == null) {
            throw new IllegalArgumentException("Trigger rule cannot be null");
        }

        String ruleType = stringValue(dto.getRuleType()).toUpperCase();
        if (!RULE_TYPES.contains(ruleType)) {
            throw new IllegalArgumentException("Unsupported rule type: " + dto.getRuleType());
        }

        ModelAction action = actionRepository.findById(dto.getActionId())
                .orElseThrow(() -> new IllegalArgumentException("Action not found: " + dto.getActionId()));
        if (!action.getModel().getId().equals(model.getId())) {
            throw new IllegalArgumentException("Action does not belong to model: " + dto.getActionId());
        }

        String eventCode = stringValue(dto.getEventCode()).toUpperCase();
        List<String> phrases = normalizePhrases(dto.getPhrases());
        if ("MOUSE".equals(ruleType)) {
            if (!MOUSE_EVENT_CODES.contains(eventCode)) {
                throw new IllegalArgumentException("Unsupported mouse event: " + dto.getEventCode());
            }
            phrases = List.of();
        } else if ("IDLE".equals(ruleType)) {
            eventCode = "IDLE";
            phrases = List.of();
        } else if (phrases.isEmpty()) {
            throw new IllegalArgumentException("Keyword rule requires at least one phrase");
        }

        ActionTriggerRule rule = new ActionTriggerRule();
        rule.setModel(model);
        rule.setModelAction(action);
        rule.setRuleType(ruleType);
        rule.setEventCode(("MOUSE".equals(ruleType) || "IDLE".equals(ruleType)) ? eventCode : "");
        rule.setPhrasesJson(writePhrases(phrases));
        rule.setEnabled(dto.getEnabled() == null || Boolean.TRUE.equals(dto.getEnabled()));
        rule.setPriority(normalizePriority(dto.getPriority()));
        return rule;
    }

    private boolean ruleMatches(ActionTriggerRule rule, String eventCode, String text) {
        if (!Boolean.TRUE.equals(rule.getEnabled())) {
            return false;
        }
        String ruleType = rule.getRuleType();
        if ("MOUSE".equals(ruleType)) {
            return !eventCode.isBlank() && eventCode.equalsIgnoreCase(stringValue(rule.getEventCode()));
        }
        if ("IDLE".equals(ruleType)) {
            return "IDLE".equalsIgnoreCase(eventCode);
        }

        List<String> phrases = parsePhrases(rule.getPhrasesJson());
        if ("KEYWORD".equals(ruleType)) {
            return !text.isBlank() && phrases.stream().anyMatch(text::contains);
        }
        return false;
    }

    private int rulePriority(ActionTriggerRule rule) {
        return normalizePriority(rule.getPriority());
    }

    private int normalizePriority(Integer priority) {
        if (priority == null) {
            return HIGHEST_PRIORITY;
        }
        return Math.max(HIGHEST_PRIORITY, Math.min(LOWEST_PRIORITY, priority));
    }

    private int ruleWeight(ActionTriggerRule rule) {
        return LOWEST_PRIORITY + 1 - rulePriority(rule);
    }

    private ActionTriggerRule selectWeightedRule(List<ActionTriggerRule> rules) {
        int totalWeight = rules.stream()
                .mapToInt(this::ruleWeight)
                .sum();
        int cursor = ThreadLocalRandom.current().nextInt(totalWeight);
        for (ActionTriggerRule rule : rules) {
            cursor -= ruleWeight(rule);
            if (cursor < 0) {
                return rule;
            }
        }
        return rules.get(rules.size() - 1);
    }

    private ActionMatchResponse toActionMatchResponse(ActionTriggerRule rule) {
        ModelAction action = rule.getModelAction();
        ActionMatchResponse response = new ActionMatchResponse();
        response.setMatched(true);
        response.setActionId(action.getId());
        response.setActionName(action.getActionName());
        response.setMotionFilePath(action.getMotionFilePath());
        response.setGroupName(action.getGroupName());
        response.setActionIndex(action.getActionIndex());
        response.setRuleType(rule.getRuleType());
        response.setEventCode(rule.getEventCode());
        return response;
    }

    private ActionTriggerRuleDto toActionTriggerRuleDto(ActionTriggerRule rule) {
        ModelAction action = rule.getModelAction();
        ActionTriggerRuleDto dto = new ActionTriggerRuleDto();
        dto.setId(rule.getId());
        dto.setRuleType(rule.getRuleType());
        dto.setEventCode(rule.getEventCode());
        dto.setPhrases(parsePhrases(rule.getPhrasesJson()));
        dto.setActionId(action.getId());
        dto.setActionName(action.getActionName());
        dto.setMotionFilePath(action.getMotionFilePath());
        dto.setGroupName(action.getGroupName());
        dto.setActionIndex(action.getActionIndex());
        dto.setEnabled(rule.getEnabled());
        dto.setPriority(rulePriority(rule));
        return dto;
    }

    private List<String> normalizePhrases(List<String> phrases) {
        if (phrases == null) {
            return List.of();
        }
        return phrases.stream()
                .map(this::stringValue)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    private String writePhrases(List<String> phrases) {
        try {
            return objectMapper.writeValueAsString(phrases == null ? List.of() : phrases);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Invalid phrases", exception);
        }
    }

    private List<String> parsePhrases(String phrasesJson) {
        if (phrasesJson == null || phrasesJson.isBlank()) {
            return List.of();
        }
        try {
            return normalizePhrases(objectMapper.readValue(phrasesJson, new TypeReference<List<String>>() {}));
        } catch (Exception exception) {
            return List.of();
        }
    }

    private Map<String, Object> toModelDto(DigitalHumanModel model) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", model.getId());
        dto.put("modelKey", model.getModelKey());
        dto.put("displayName", model.getDisplayName());
        dto.put("modelPath", model.getModelPath());
        dto.put("status", model.getStatus());
        dto.put("updatedAt", model.getUpdatedAt());
        return dto;
    }

    private Map<String, Object> toActionDto(ModelAction action) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", action.getId());
        dto.put("actionKey", action.getActionKey());
        dto.put("actionName", action.getActionName());
        dto.put("motionFilePath", action.getMotionFilePath());
        dto.put("groupName", action.getGroupName());
        dto.put("actionIndex", action.getActionIndex());
        dto.put("enabled", action.getEnabled());
        return dto;
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String normalizeGroupName(String groupName) {
        return "\"\"".equals(groupName) ? "" : groupName;
    }
}
