import sys
import json

def main():
    try:
        data = json.load(sys.stdin)
        tool_name = data.get("toolCall", {}).get("name", "")
        args = data.get("toolCall", {}).get("args", {})
        
        # 1. 파일 생성/수정 및 태스크 관리 도구인 경우 자동 승인
        if tool_name in ["write_to_file", "replace_file_content", "manage_task"]:
            print(json.dumps({"decision": "allow"}))
            return
            
        # 2. 터미널 명령어 도구인 경우
        if tool_name == "run_command":
            cmd = args.get("CommandLine", "").strip()
            
            # rm 및 docker run 은 명시적으로 제외(확인 요청)
            if cmd == "rm" or cmd.startswith("rm ") or "docker run" in cmd:
                print(json.dumps({"decision": "ask"}))
                return
            
            allowed_commands = [
                # Git
                "git status", "git diff", "git log", "git show", "git branch",
                "git add", "git checkout", "git switch",
                # 파일/디렉토리 및 시스템 확인 (rm 제외)
                "find", "ls", "cat", "grep", "echo", "head", "tail", "wc", "pwd", "which",
                "mkdir", "cp", "mv", "touch",
                # 런타임/패키지/빌드/네트워크
                "yarn", "node", "npm", "npx", "curl",
                "./gradlew", "../gradlew", "sh .agents/skills/cartog/scripts/cartog.sh",
                # 프로세스/포트 확인
                "lsof", "ps",
                # Docker (docker run 제외)
                "docker compose", "docker-compose", "docker ps", "docker logs"
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
