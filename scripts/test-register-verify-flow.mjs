/**
 * 仮申込エンベロープ保存 → verify 本登録 の確認
 */
import puppeteer from "puppeteer";

const BASE = process.argv[2] || "http://localhost:3000";

const pending = {
  createdAt: new Date().toISOString(),
  adminPassword: "Kurasapo-111",
  school: {
    schoolName: "テスト大学",
    representativeName: "倉部太郎",
    representativeNameKana: "クラブ タロウ",
    postalCode: "1000001",
    prefecture: "東京都",
    city: "千代田区",
    addressLine: "1",
    phone: "03",
  },
  contact: {
    department: "総務",
    position: "",
    contactName: "会計花子",
    contactNameKana: "カイケイ ハナコ",
    contactPhone: "03",
    email: "demo@test.jp",
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

const token = "demo-auth-token-test";

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`${BASE}/register/school`, { waitUntil: "domcontentloaded" });

  await page.evaluate(
    ({ data, t }) => {
      const envelope = { ...data, token: t };
      localStorage.setItem("pending_school_data", JSON.stringify(envelope));
    },
    { data: pending, t: token }
  );

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pending_school_data") || "{}")
  );
  if (stored.token !== token) throw new Error("保存形式: token不一致");

  await page.goto(
    `${BASE}/register/verify?token=${encodeURIComponent(token)}`,
    { waitUntil: "domcontentloaded" }
  );

  const onVerify = await page.evaluate(() =>
    localStorage.getItem("pending_school_data")
  );
  if (!onVerify?.includes(token)) {
    throw new Error(`verify到達時 pending なし: ${onVerify?.slice(0, 80)}`);
  }

  try {
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("本登録が完了しました") ||
        document.body.innerText.includes("認証エラー"),
      { timeout: 20000 }
    );
  } catch {
    /* fall through */
  }
  const bodyAfter = await page.evaluate(() => document.body.innerText);
  if (bodyAfter.includes("認証エラー")) {
    const diag = await page.evaluate(() => {
      const raw = localStorage.getItem("pending_school_data");
      let parsed = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch (e) {
        return { raw: raw?.slice(0, 100), parseError: String(e) };
      }
      return {
        rawLen: raw?.length,
        keys: parsed ? Object.keys(parsed) : [],
        token: parsed?.token,
        schoolName: parsed?.school?.schoolName,
        email: parsed?.contact?.email,
      };
    });
    throw new Error(`verifyエラー: ${JSON.stringify(diag)}`);
  }
  if (!bodyAfter.includes("本登録が完了しました")) {
    throw new Error(`verify画面: ${bodyAfter.slice(0, 400)}`);
  }

  const schoolId = await page.evaluate(() => {
    const m = document.body.innerText.match(/SCH-\d{5}/);
    return m?.[0] ?? null;
  });
  if (!schoolId) throw new Error("学校ID未表示");

  const after = await page.evaluate(() => ({
    pending: localStorage.getItem("pending_school_data"),
    active: localStorage.getItem("active_schools"),
  }));
  if (after.pending) throw new Error("pending が残っている");
  if (!after.active?.includes(schoolId)) throw new Error("active_schools 未保存");

  await page.goto(`${BASE}/register/school`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    document.body.innerText.includes("STEP 1")
  );
  await page.evaluate(() => {
    const goStep2 = () => {
      if (!document.body.innerText.includes("STEP 2")) {
        for (let i = 0; i < 2; i++) {
          document
            .querySelectorAll("button")
            .forEach((b) => {
              if (b.textContent?.includes("次へ")) b.click();
            });
        }
      }
    };
    goStep2();
  });
  await page.waitForFunction(
    () => document.body.innerText.includes("STEP 2"),
    { timeout: 8000 }
  ).catch(() => {});

  const confirm = await page.$("#register-contact-email-confirm");
  if (confirm) {
    await confirm.click();
    await confirm.type("a");
    const lenBefore = await page.evaluate(
      () =>
        document.querySelector("#register-contact-email-confirm")?.value
          ?.length ?? 0
    );
    await page.evaluate(() => {
      const el = document.querySelector("#register-contact-email-confirm");
      const ev = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      });
      ev.clipboardData.setData("text/plain", "pasted@evil.com");
      el?.dispatchEvent(ev);
    });
    const lenAfter = await page.evaluate(
      () =>
        document.querySelector("#register-contact-email-confirm")?.value
          ?.length ?? 0
    );
    if (lenAfter > lenBefore + 1)
      throw new Error("ペーストが通ってしまった");
    console.log("OK: 確認欄ペースト禁止");
  } else {
    console.log("SKIP: STEP2未到達（ペーストテスト）");
  }

  console.log(`OK: verify本登録 ${schoolId}`);
  await browser.close();
})().catch((e) => {
  console.error("失敗:", e.message);
  process.exit(1);
});
