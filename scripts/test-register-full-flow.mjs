/**
 * 仮申込 → token認証 → 学校ID発行 → ログイン の一気通貫デモ確認
 * Usage: node scripts/test-register-full-flow.mjs [baseUrl]
 */
import puppeteer from "puppeteer";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = "Kurasapo-111";

const pending = {
  createdAt: new Date().toISOString(),
  adminPassword: PASSWORD,
  school: {
    schoolName: "デモ大学",
    representativeName: "倉部太郎",
    representativeNameKana: "クラブ タロウ",
    postalCode: "1000001",
    prefecture: "東京都",
    city: "千代田区",
    addressLine: "1-1",
    phone: "03-1111-2222",
  },
  contact: {
    department: "総務部",
    position: "",
    contactName: "会計花子",
    contactNameKana: "カイケイ ハナコ",
    contactPhone: "03-3333-4444",
    email: "demo@example.com",
  },
  contract: {
    plan: "standard",
    settlementMonth: 3,
    settlementDay: 31,
    paymentCycle: "monthly",
    monthlyBillingDay: 26,
    paymentMethod: "bank_transfer",
  },
  termsAcceptedAt: new Date().toISOString(),
};

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const token = `demo_${Date.now()}`;
  await page.goto(`${BASE}/register/school`, { waitUntil: "domcontentloaded" });

  await page.evaluate(
    ({ t, data }) => {
      localStorage.setItem(
        "pending_school_data",
        JSON.stringify({ ...data, token: t })
      );
    },
    { t: token, data: pending }
  );

  await page.goto(`${BASE}/register/verify?token=${encodeURIComponent(token)}`, {
    waitUntil: "networkidle0",
  });

  await page.waitForFunction(
    () => document.body.innerText.includes("本登録が完了しました"),
    { timeout: 15000 }
  );

  const schoolId = await page.evaluate(() => {
    const m = document.body.innerText.match(/SCH-\d{5}/);
    return m ? m[0] : null;
  });
  if (!schoolId) throw new Error("学校IDが画面に表示されていません");

  const stored = await page.evaluate(() => ({
    active: localStorage.getItem("active_schools"),
    pending: localStorage.getItem("pending_school_data"),
    contract: localStorage.getItem("contract_info"),
  }));
  if (!stored.active?.includes(schoolId))
    throw new Error("active_schools に未保存");
  if (stored.pending) throw new Error("pending が残っている");
  if (!stored.contract?.includes(schoolId))
    throw new Error("contract_info 未反映");

  await page.click('a[href="/school/login"]');
  await page.waitForFunction(
    () => location.pathname.includes("/school/login"),
    { timeout: 10000 }
  );

  await page.waitForSelector("#schoolLoginId");
  const idEl = await page.$("#schoolLoginId");
  const pwEl = await page.$("#schoolPassword");
  await idEl.click({ clickCount: 3 });
  await idEl.type(schoolId, { delay: 5 });
  await pwEl.click({ clickCount: 3 });
  await pwEl.type(PASSWORD, { delay: 5 });
  await page.click('button[type="submit"]');

  await page.waitForFunction(
    () => location.pathname === "/school",
    { timeout: 15000 }
  );

  console.log(`OK: ${schoolId} でログイン → /school（管理者ポータル）`);
  await browser.close();
})().catch((e) => {
  console.error("失敗:", e.message);
  process.exit(1);
});
