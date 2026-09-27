import sys
import json

def main():
    try:
        data = json.load(sys.stdin)
        tool_name = data.get("toolCall", {}).get("name", "")
        args = data.get("toolCall", {}).get("args", {})
        
        # 1. 파일 생성 및 수정 도구인 경우 무조건 자동 승인
        if tool_name in ["write_to_file", "replace_file_content"]:
            print(json.dumps({"decision": "allow"}))
            return
            
        # 2. 터미널 명령어 도구인 경우 (기존 로직 유지)
        if tool_name == "run_command":
            cmd = args.get("CommandLine", "")
            
            allowed_commands = [
                "git status", "git diff", "git log", "git show", "git branch",
                "find", "ls", "cat", "grep", "echo",
                "yarn", "./gradlew", "../gradlew", "sh .agents/skills/cartog/scripts/cartog.sh"
            ]
            
            def is_allowed(target_cmd, base_cmd):
                return target_cmd == base_cmd or target_cmd.startswith(base_cmd + " ")
                
            for base in allowed_commands:
                if is_allowed(cmd, base):
                    print(json.dumps({"decision": "allow"}))
                    return
                    
        # 3. 그 외의 경우 안전하게 사용자에게 묻기
        print(json.dumps({"decision": "ask"}))
        
    except Exception:
        print(json.dumps({"decision": "ask"}))

if __name__ == "__main__":
    main()
