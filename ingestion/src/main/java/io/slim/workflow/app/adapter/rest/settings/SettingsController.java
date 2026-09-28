package io.slim.workflow.app.adapter.rest.settings;

import io.slim.workflow.app.adapter.rest.settings.dto.SettingItemDto;
import io.slim.workflow.app.adapter.rest.settings.dto.SettingOptionDto;
import io.slim.workflow.app.adapter.rest.settings.dto.SettingType;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Arrays;

@RestController
@RequestMapping("/api/platforms/configs")
public class SettingsController {

    private final List<SettingItemDto> inMemoryConfigs = new ArrayList<>();

    public SettingsController() {
        inMemoryConfigs.add(SettingItemDto.builder().key("test.editor.fontSize").type(SettingType.NUMBER).label("폰트 크기").description("에디터 폰트 크기를 설정합니다.").value(14).group("Editor").build());
        inMemoryConfigs.add(SettingItemDto.builder().key("test.editor.wordWrap").type(SettingType.BOOLEAN).label("자동 줄바꿈").description("에디터 자동 줄바꿈 활성화 여부").value(true).group("Editor").build());
        inMemoryConfigs.add(SettingItemDto.builder().key("test.workbench.colorTheme").type(SettingType.SELECT).label("색상 테마").description("워크벤치의 색상 테마를 선택합니다.").value("Dark")
                .options(Arrays.asList(new SettingOptionDto("Dark", "Dark"), new SettingOptionDto("Light", "Light"))).group("Workbench").build());
        inMemoryConfigs.add(SettingItemDto.builder().key("test.files.autoSave").type(SettingType.SELECT).label("자동 저장").description("파일 자동 저장 방식을 설정합니다.").value("afterDelay")
                .options(Arrays.asList(new SettingOptionDto("off", "off"), new SettingOptionDto("afterDelay", "afterDelay"), new SettingOptionDto("onFocusChange", "onFocusChange"))).group("Files").build());
        inMemoryConfigs.add(SettingItemDto.builder().key("test.window.title").type(SettingType.STRING).label("창 제목").description("애플리케이션 창의 기본 제목").value("My App").group("Window").build());
        inMemoryConfigs.add(SettingItemDto.builder().key("test.debug.allowBreakpointsEverywhere").type(SettingType.BOOLEAN).label("모든 곳에 중단점 허용").description("모든 파일에 중단점을 설정할 수 있게 허용").value(false).group("Debug").build());
        inMemoryConfigs.add(SettingItemDto.builder().key("test.terminal.integrated.fontSize").type(SettingType.NUMBER).label("터미널 폰트 크기").description("내장 터미널의 폰트 크기").value(12).group("Terminal").build());
        inMemoryConfigs.add(SettingItemDto.builder().key("test.telemetry.enableCrashReporter").type(SettingType.BOOLEAN).label("크래시 리포트").description("크래시 리포트를 익명으로 전송").value(true).group("Telemetry").build());
        inMemoryConfigs.add(SettingItemDto.builder().key("test.update.mode").type(SettingType.SELECT).label("업데이트 모드").description("애플리케이션 업데이트 모드").value("default")
                .options(Arrays.asList(new SettingOptionDto("default", "default"), new SettingOptionDto("manual", "manual"), new SettingOptionDto("none", "none"))).group("Update").build());
        inMemoryConfigs.add(SettingItemDto.builder().key("test.search.exclude").type(SettingType.STRING).label("검색 제외 패턴").description("검색 시 제외할 파일 또는 폴더 패턴").value("**/node_modules").group("Search").build());
    }

    @GetMapping
    public List<SettingItemDto> getConfigs() {
        return inMemoryConfigs;
    }

    @PatchMapping
    public void updateConfigs(@RequestBody List<SettingItemDto> items) {
        for (SettingItemDto item : items) {
            inMemoryConfigs.stream()
                .filter(c -> c.getKey().equals(item.getKey()))
                .findFirst()
                .ifPresent(c -> c.setValue(item.getValue()));
        }
    }

    @PostMapping
    public void addConfig(@RequestBody SettingItemDto item) {
        // Prevent duplicate keys
        if (inMemoryConfigs.stream().noneMatch(c -> c.getKey().equals(item.getKey()))) {
            inMemoryConfigs.add(item);
        } else {
            throw new IllegalArgumentException("Config key already exists");
        }
    }
}
