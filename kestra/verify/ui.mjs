// 실제 브라우저(Chromium)로 UI 동작과 CSRF 노출을 검증한다.
// 실행: verify/ui.sh (compose 네트워크 안의 Playwright 컨테이너에서 돈다)
import {chromium} from "playwright";

const BASE = "http://kestra.localtest.me:4180";
const OUT = process.env.OUT ?? "/out";
const results = [];
const ok = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

console.log("[UI-1] OIDC 로그인 후 Kestra UI 가 Basic 로그인 화면 없이 열린다");
await page.goto(`${BASE}/ui/`);
await page.waitForURL(/dex\.localtest\.me/);
await page.fill("input[name=login]", "alice@example.com");
await page.fill("input[name=password]", "password");
await page.click("button[type=submit]");
await page.waitForURL(/kestra\.localtest\.me:4180\/ui/);
await page.waitForLoadState("networkidle");
await page.screenshot({path: `${OUT}/1-after-login.png`});
const url1 = page.url();
const hasPwdField = await page.locator("input[type=password]").count();
ok("Kestra 로그인 화면으로 가지 않음", !/\/login/.test(url1) && hasPwdField === 0, url1);

await page.goto(`${BASE}/ui/main/flows`);
await page.waitForLoadState("networkidle");
await page.screenshot({path: `${OUT}/2-flows.png`});
ok("flow 목록에 audit_probe 표시", (await page.getByText("audit_probe").count()) > 0);

console.log("[UI-2] UI 의 쓰기 요청(실행 생성)이 동작한다 (UI 와 같은 방식: X-CSRF-TOKEN 포함)");
const write = await page.evaluate(async () => {
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? "";
  const r = await fetch("/api/v1/main/executions/poc.audit/audit_probe", {
    method: "POST", credentials: "include", headers: {"X-CSRF-TOKEN": token},
  });
  return r.status;
});
ok("UI 컨텍스트에서 실행 생성", write === 200, `HTTP ${write}`);

console.log("[UI-3] CSRF: 다른 사이트의 자동 제출 폼");
async function csrfFrom(origin) {
  const atk = await ctx.newPage();
  await atk.route(`${origin}/**`, (route) => route.fulfill({
    contentType: "text/html",
    body: `<form id=f method=POST enctype="multipart/form-data" action="${BASE}/api/v1/main/executions/poc.audit/audit_probe"></form>
           <script>document.getElementById('f').submit()</script>`,
  }));
  const resp = atk.waitForResponse((r) => r.url().includes("/executions/poc.audit/audit_probe"));
  await atk.goto(`${origin}/`);
  const status = (await resp).status();
  await atk.close();
  return status;
}
const cross = await csrfFrom("http://attacker.test");
ok("cross-site(attacker.test) 는 SameSite=Lax 로 차단", cross !== 200, `HTTP ${cross}`);
const same = await csrfFrom("http://evil.localtest.me");
// 기대: 같은 site(localtest.me) 의 다른 서브도메인은 쿠키가 실리므로 통과한다 = 남는 위험
// 같은 site(localtest.me) 의 다른 서브도메인은 SameSite 로 못 막는다. JWT 마커 쿠키로 Kestra CSRF 검사가 막아야 한다.
ok("same-site(evil.localtest.me) 는 Kestra CSRF 검사로 차단", same === 403, `HTTP ${same}`);

console.log("[UI-4] UI 로그아웃 동작");
await page.goto(`${BASE}/ui/main/flows`);
await page.waitForLoadState("networkidle");
const logout = await page.evaluate(async () => {
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? "";
  return (await fetch("/api/v1/logout", {method: "POST", credentials: "include", headers: {"X-CSRF-TOKEN": token}})).status;
});
const flagAfterLogout = (await ctx.cookies()).find((c) => c.name === "kestraBasicAuthenticated")?.value;
await page.reload();
await page.waitForLoadState("networkidle");
await page.screenshot({path: `${OUT}/3-after-logout-reload.png`});
console.log(`  INFO  /api/v1/logout → HTTP ${logout}, 직후 플래그=${flagAfterLogout ?? "(없음)"}, 새로고침 후 URL=${page.url()}`);
ok("새로고침하면 다시 로그인 상태(OIDC 세션 유지)", !/\/login/.test(page.url()));

await browser.close();
const fails = results.filter((r) => !r).length;
console.log(`\n결과: PASS=${results.length - fails} FAIL=${fails}`);
process.exit(fails ? 1 : 0);
