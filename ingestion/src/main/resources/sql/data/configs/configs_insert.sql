INSERT INTO system_configs (config_key, type, label, description, config_value, options, group_name) VALUES
('test.editor.fontSize', 'NUMBER', '폰트 크기', '에디터 폰트 크기를 설정합니다.', '14', NULL, 'Editor'),
('test.editor.wordWrap', 'BOOLEAN', '자동 줄바꿈', '에디터 자동 줄바꿈 활성화 여부', 'true', NULL, 'Editor'),
('test.workbench.colorTheme', 'SELECT', '색상 테마', '워크벤치의 색상 테마를 선택합니다.', 'Dark', '[{"label":"Dark", "value":"Dark"},{"label":"Light", "value":"Light"}]', 'Workbench'),
('test.files.autoSave', 'SELECT', '자동 저장', '파일 자동 저장 방식을 설정합니다.', 'afterDelay', '[{"label":"off", "value":"off"},{"label":"afterDelay", "value":"afterDelay"},{"label":"onFocusChange", "value":"onFocusChange"}]', 'Files'),
('test.window.title', 'STRING', '창 제목', '애플리케이션 창의 기본 제목', 'My App', NULL, 'Window'),
('test.debug.allowBreakpointsEverywhere', 'BOOLEAN', '모든 곳에 중단점 허용', '모든 파일에 중단점을 설정할 수 있게 허용', 'false', NULL, 'Debug'),
('test.terminal.integrated.fontSize', 'NUMBER', '터미널 폰트 크기', '내장 터미널의 폰트 크기', '12', NULL, 'Terminal'),
('test.telemetry.enableCrashReporter', 'BOOLEAN', '크래시 리포트', '크래시 리포트를 익명으로 전송', 'true', NULL, 'Telemetry'),
('test.update.mode', 'SELECT', '업데이트 모드', '애플리케이션 업데이트 모드', 'default', '[{"label":"default", "value":"default"},{"label":"manual", "value":"manual"},{"label":"none", "value":"none"}]', 'Update'),
('test.search.exclude', 'STRING', '검색 제외 패턴', '검색 시 제외할 파일 또는 폴더 패턴', '**/node_modules', NULL, 'Search');
