package io.slim.workflow.domain.utils;

import org.springframework.util.PropertyPlaceholderHelper;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * 동적 템플릿 문자열(Property Placeholder 문법)을 런타임 변수와 조합하여 파싱하는 유틸리티 클래스입니다.
 * <p>
 * 예시: "{filename}_{date:yyyyMMdd}.csv" -> "daily_sales_20260813.csv"
 */
public final class TemplateUtils {

    // Spring 내부의 파싱 엔진을 그대로 재사용 (Thread-safe)
    // 접두사 "{", 접미사 "}" 형태의 문법을 파싱하도록 설정
    private static final PropertyPlaceholderHelper helper = 
            new PropertyPlaceholderHelper("{", "}");

    // 유틸리티 클래스이므로 인스턴스화 방지
    private TemplateUtils() {
        throw new UnsupportedOperationException("Utility class cannot be instantiated");
    }

    /**
     * 템플릿 문자열과 변수 맵을 받아 최종 치환된 문자열을 반환합니다.
     *
     * @param exprString 템플릿 문자열 (예: "users/v2/{filename}_{date:yyyyMMdd}.csv")
     * @param variables  치환할 변수가 담긴 맵 (예: Map.of("filename", "sales"))
     * @return 치환이 완료된 문자열
     */
    public static String resolve(String exprString, Map<String, String> variables) {
        if (!StringUtils.hasText(exprString) || !exprString.contains("{")) {
            return exprString; // 파싱할 필요가 없는 경우 빠른 반환
        }

        return helper.replacePlaceholders(exprString, key -> {
            
            // 1. 날짜 포맷팅 요청 처리 ("date:포맷" 형태)
            if (key.startsWith("date:")) {
                String formatPattern = key.substring(5); // "date:" 이후의 패턴 추출
                try {
                    return LocalDateTime.now().format(DateTimeFormatter.ofPattern(formatPattern));
                } catch (Exception e) {
                    // 잘못된 포맷팅이 들어왔을 경우 원본 키를 반환하거나 에러 문자열 처리
                    return "{INVALID_DATE_FORMAT:" + formatPattern + "}";
                }
            }
            
            // 2. 일반 변수 처리 (맵에서 조회)
            // 맵에 존재하지 않는 변수라면 빈 문자열(또는 null 반환 시 원본 {key} 유지)로 처리
            return variables.getOrDefault(key, "");
        });
    }
}
