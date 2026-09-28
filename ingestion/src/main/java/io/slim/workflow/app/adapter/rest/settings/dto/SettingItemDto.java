package io.slim.workflow.app.adapter.rest.settings.dto;

import java.util.List;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SettingItemDto {
    private String key;
    private SettingType type;
    private String label;
    private String description;
    private Object value;
    private List<SettingOptionDto> options;
    private String group;
}
