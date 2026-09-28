package io.slim.workflow.app.adapter.rest.settings.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SettingOptionDto {
    private String label;
    private String value;
}
