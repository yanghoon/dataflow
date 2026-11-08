"""Kestra API 보조(표준 라이브러리만). verify.sh 가 쓴다.

  python kestra_api.py run <ns> <flow> [k=v ...]   실행하고 끝날 때까지 기다린다. 마지막 줄: <id> <상태>
  python kestra_api.py restart <execId>              restart 하고 끝날 때까지 기다린다
  python kestra_api.py tasks <execId>                작업별 상태와 시도 수
  python kestra_api.py backfill <ns> <flow> <trigger> <start> <end>
  python kestra_api.py search <ns> <flow>            실행 목록: <id> <상태> <trigger.date>
  python kestra_api.py logs <execId>                 실행 로그 전체(TRACE 포함)
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get("KESTRA_URL", "http://localhost:8080") + "/api/v1/main"
AUTH = "Basic " + base64.b64encode(os.environ.get("KESTRA_AUTH", "admin@example.com:Kestra1234").encode()).decode()
DONE = {"SUCCESS", "FAILED", "KILLED", "WARNING", "CANCELLED"}


def call(method, path, body=None, ctype=None):
    req = urllib.request.Request(BASE + path, data=body, method=method, headers={"Authorization": AUTH})
    if ctype:
        req.add_header("Content-Type", ctype)
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def wait(eid, timeout=900):
    t0 = time.time()
    while True:
        ex = call("GET", f"/executions/{eid}")
        if ex["state"]["current"] in DONE or time.time() - t0 > timeout:
            return ex
        time.sleep(2)


def tasks(ex):
    for tr in ex.get("taskRunList") or []:
        print(f"   {tr['taskId']:<16} {tr['state']['current']:<8} attempts={len(tr.get('attempts') or [])}")


def run(ns, flow, inputs):
    b = uuid.uuid4().hex
    body = "".join(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n' for k, v in inputs.items())
    ex = call("POST", f"/executions/{ns}/{flow}", (body + f"--{b}--\r\n").encode(), f"multipart/form-data; boundary={b}")
    ex = wait(ex["id"])
    tasks(ex)
    print(ex["id"], ex["state"]["current"])


def main(cmd, *a):
    if cmd == "run":
        run(a[0], a[1], dict(x.split("=", 1) for x in a[2:]))
    elif cmd == "restart":
        call("POST", f"/executions/{a[0]}/actions/restart")
        time.sleep(2)
        ex = wait(a[0])
        tasks(ex)
        print(ex["id"], ex["state"]["current"])
    elif cmd == "tasks":
        tasks(call("GET", f"/executions/{a[0]}"))
    elif cmd == "backfill":
        body = {"namespace": a[0], "flowId": a[1], "triggerId": a[2], "backfill": {"start": a[3], "end": a[4]}}
        call("PUT", "/triggers/backfill/create", json.dumps(body).encode(), "application/json")
    elif cmd == "search":
        for e in call("GET", f"/executions/search?namespace={a[0]}&flowId={a[1]}&size=100")["results"]:
            date = ((e.get("trigger") or {}).get("variables") or {}).get("date")
            print(e["id"], e["state"]["current"], date)
    elif cmd == "logs":
        for line in call("GET", f"/logs/{a[0]}?minLevel=TRACE") or []:
            print(line.get("taskId"), line.get("level"), line.get("message"))


if __name__ == "__main__":
    try:
        main(*sys.argv[1:])
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:500]}")
