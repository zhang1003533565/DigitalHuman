package com.digitalhuman.backend_java.controller;

import com.digitalhuman.backend_java.dto.VoiceScriptImportResponse;
import com.digitalhuman.backend_java.dto.VoiceScriptSceneRequest;
import com.digitalhuman.backend_java.model.VoiceScriptScene;
import com.digitalhuman.backend_java.service.VoiceScriptSceneService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/admin/voice-scripts")
public class AdminVoiceScriptController {

    private final VoiceScriptSceneService service;

    public AdminVoiceScriptController(VoiceScriptSceneService service) {
        this.service = service;
    }

    @GetMapping("/records")
    public List<VoiceScriptScene> listRecords() {
        return service.listAll();
    }

    @GetMapping("/records/{id}")
    public VoiceScriptScene getRecord(@PathVariable Long id) {
        return service.getById(id);
    }

    @PostMapping("/records")
    public VoiceScriptScene createRecord(@Valid @RequestBody VoiceScriptSceneRequest request) {
        return service.create(request);
    }

    @PutMapping("/records/{id}")
    public VoiceScriptScene updateRecord(@PathVariable Long id, @Valid @RequestBody VoiceScriptSceneRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/records/{id}")
    public void deleteRecord(@PathVariable Long id) {
        service.delete(id);
    }

    @PostMapping("/records/{id}/publish")
    public VoiceScriptScene publishRecord(@PathVariable Long id) {
        return service.publish(id);
    }

    @PostMapping("/import-docx")
    public VoiceScriptImportResponse importDocx(
            @RequestParam("file") MultipartFile file,
            @RequestParam("scenicName") String scenicName,
            @RequestParam(name = "style", defaultValue = "culture") String style,
            @RequestParam(name = "versionNo", defaultValue = "1") Integer versionNo) {
        return service.importFromDocx(file, scenicName, style, versionNo);
    }
}
