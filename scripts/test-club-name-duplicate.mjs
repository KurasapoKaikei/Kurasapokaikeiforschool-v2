/** クラブ名重複チェック（ロジック単体 + ブラウザ E2E） */
function isDuplicateClubName(name, clubs, excludeClubId) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return clubs.some(
    (c) => c.id !== excludeClubId && c.name.trim() === trimmed
  );
}

let ok = true;
const clubs = [
  { id: "club-1001", name: "新聞会", groupIds: [], groupNames: [], registeredAt: "", order: 1 },
  { id: "club-1002", name: "  サッカー部  ", groupIds: [], groupNames: [], registeredAt: "", order: 2 },
];

if (!isDuplicateClubName("新聞会", clubs)) {
  console.log("FAIL: 新聞会 should be duplicate");
  ok = false;
} else console.log("OK: 新聞会は重複");

if (!isDuplicateClubName("サッカー部", clubs)) {
  console.log("FAIL: サッカー部 should be duplicate (trim)");
  ok = false;
} else console.log("OK: サッカー部（空白除去）は重複");

if (isDuplicateClubName("吹奏楽部", clubs)) {
  console.log("FAIL: 吹奏楽部 should not be duplicate");
  ok = false;
} else console.log("OK: 吹奏楽部は新規");

if (isDuplicateClubName("新聞会", clubs, "club-1001")) {
  console.log("FAIL: exclude self should not count as duplicate");
  ok = false;
} else console.log("OK: 自分自身の編集は除外");

if (!ok) process.exit(1);

const runE2E = process.argv.includes("--e2e");
const baseArg = process.argv.find((a) => a.startsWith("http"));
const BASE = baseArg || process.env.BASE_URL || "http://localhost:3000";

if (!runE2E) {
  console.log("ロジック単体テスト完了（--e2e でブラウザ検証）");
  process.exit(0);
}

const puppeteer = await import("puppeteer").catch(() => null);
if (!puppeteer) {
  console.error("puppeteer がありません: npx puppeteer scripts/test-club-name-duplicate.mjs --e2e");
  process.exit(1);
}

const DUPLICATE_MSG = "※このクラブ名は既に登録されています。";
const seedClubs = [
  {
    id: "club-9001",
    name: "新聞会",
    groupIds: ["grp-1"],
    groupNames: ["運動系"],
    registeredAt: new Date().toISOString(),
    order: 1,
    initialPassword: "Ab12cd",
    password: "Ab12cd",
  },
];
const seedGroups = [{ id: "grp-1", name: "運動系", order: 1 }];

const browser = await puppeteer.default.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(`${BASE}/school/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ clubs, groups }) => {
      localStorage.setItem("kurasaokaikei-school-clubs", JSON.stringify(clubs));
      localStorage.setItem("kurasaokaikei-school-club-groups", JSON.stringify(groups));
    },
    { clubs: seedClubs, groups: seedGroups }
  );
  await page.goto(`${BASE}/school/clubs/register`, { waitUntil: "networkidle0" });
  await page.waitForSelector('input[name="clubGroup"]', { timeout: 15000 });

  await page.click('input[name="clubGroup"]');
  await page.type("#clubName", "吹奏楽部");
  const beforeCount = await page.evaluate(() => {
    const raw = localStorage.getItem("kurasaokaikei-school-clubs");
    return raw ? JSON.parse(raw).length : 0;
  });
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    (prev) => {
      const raw = localStorage.getItem("kurasaokaikei-school-clubs");
      const n = raw ? JSON.parse(raw).length : 0;
      return n > prev;
    },
    { timeout: 10000 },
    beforeCount
  );
  const afterNew = await page.evaluate(() => {
    const raw = localStorage.getItem("kurasaokaikei-school-clubs");
    return JSON.parse(raw).some((c) => c.name === "吹奏楽部");
  });
  if (!afterNew) throw new Error("吹奏楽部が登録されていない");
  console.log("OK: 吹奏楽部を新規登録できた");

  await page.click("#clubName", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#clubName", "新聞会", { delay: 10 });
  await page.waitForFunction(
    (msg) => document.body.innerText.includes(msg),
    { timeout: 5000 },
    DUPLICATE_MSG
  );
  const submitDisabled = await page.$eval(
    'button[type="submit"]',
    (btn) => btn.disabled
  );
  if (!submitDisabled) throw new Error("重複時に登録ボタンが有効のまま");
  const countBeforeDup = await page.evaluate(() => JSON.parse(localStorage.getItem("kurasaokaikei-school-clubs")).length);
  await page.click('button[type="submit"]');
  await new Promise((r) => setTimeout(r, 500));
  const countAfterDup = await page.evaluate(() => JSON.parse(localStorage.getItem("kurasaokaikei-school-clubs")).length);
  if (countAfterDup !== countBeforeDup) throw new Error("重複登録で件数が増えた");
  console.log("OK: 新聞会の重複登録がブロックされた");
} catch (e) {
  console.error("E2E失敗:", e.message);
  process.exit(1);
} finally {
  await browser.close();
}

console.log("E2E完了");
