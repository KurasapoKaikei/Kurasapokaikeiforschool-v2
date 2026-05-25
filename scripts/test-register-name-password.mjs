import puppeteer from "puppeteer";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3001";
const STRENGTH_MSG =
  "パスワードは英大文字・小文字・数字・記号をそれぞれ1文字以上含み、8文字以上で入力してください";

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${BASE}/register/school`, { waitUntil: "networkidle0" });

  const phs = await page.evaluate(() =>
    [...document.querySelectorAll("input[placeholder]")].map((i) => i.placeholder)
  );
  if (!phs.includes("例：クラサポ大学")) throw new Error("学校名PH: " + phs.join(","));
  if (!phs.includes("例：倉部") || !phs.includes("例：太郎"))
    throw new Error("代表者PH: " + phs.join(","));

  const fill = async (pairs) => {
    await page.evaluate((data) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      for (const [ph, v] of data) {
        const el = [...document.querySelectorAll("input")].find(
          (i) => i.placeholder === ph
        );
        if (el) {
          setter?.call(el, v);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    }, pairs);
  };

  const next = () =>
    page.evaluate(() => {
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent?.includes("次へ"))
        ?.click();
    });

  const setEmails = async (email, confirm) => {
    const sel = (id) => `[data-testid="${id}"]`;
    const e0 = await page.waitForSelector(sel("register-contact-email"));
    const e1 = await page.waitForSelector(sel("register-contact-email-confirm"));
    await e0.click({ clickCount: 3 });
    await e0.type(email, { delay: 5 });
    await e1.click({ clickCount: 3 });
    await e1.type(confirm, { delay: 5 });
  };

  await fill([
    ["例：クラサポ大学", "クラサポ大学"],
    ["例：倉部", "倉部"],
    ["例：太郎", "太郎"],
    ["例：クラブ", "クラブ"],
    ["例：タロウ", "タロウ"],
    ["例：102-0074", "102-0074"],
    ["例：東京都", "東京都"],
    ["例：千代田区", "千代田区"],
    ["例：富士見台2-11-1", "1-1"],
    ["例：03-5211-7171", "03-1111-2222"],
  ]);
  await next();
  await page.waitForFunction(() => document.body.innerText.includes("STEP 2"));

  const step2Buttons = await page.evaluate(() => ({
    back: [...document.querySelectorAll("button")].some((b) =>
      b.textContent?.includes("戻る")
    ),
    cancel: [...document.querySelectorAll("a")].some((a) =>
      a.textContent?.includes("キャンセル")
    ),
  }));
  if (!step2Buttons.back || !step2Buttons.cancel)
    throw new Error("STEP2 buttons: " + JSON.stringify(step2Buttons));

  await fill([
    ["例：学生支援課 部活動統括係", "総務部"],
    ["例：会計", "会計"],
    ["例：花子", "花子"],
    ["例：カイケイ", "カイケイ"],
    ["例：ハナコ", "ハナコ"],
    ["例：03-5211-7172", "03-3333-4444"],
  ]);
  await setEmails("hanako@example.com", "wrong@example.com");
  await next();
  await new Promise((r) => setTimeout(r, 300));
  let body = await page.evaluate(() => document.body.innerText);
  if (!body.includes("メールアドレスが一致しません"))
    throw new Error("メール不一致エラーなし");

  await setEmails("hanako@example.com", "hanako@example.com");
  await next();
  await page.waitForFunction(() => document.body.innerText.includes("STEP 3"));

  await page.evaluate(() => {
    const pw = [...document.querySelectorAll('input[type="password"]')];
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(pw[0], "1234");
    pw[0].dispatchEvent(new Event("input", { bubbles: true }));
    setter?.call(pw[1], "1234");
    pw[1].dispatchEvent(new Event("input", { bubbles: true }));
  });
  await next();
  await new Promise((r) => setTimeout(r, 300));
  body = await page.evaluate(() => document.body.innerText);
  if (!body.includes(STRENGTH_MSG.slice(0, 20)))
    throw new Error("弱いPWでエラーなし");

  const pw0 = await page.waitForSelector(
    '[data-testid="register-admin-password"]'
  );
  const pw1 = await page.waitForSelector(
    '[data-testid="register-admin-password-confirm"]'
  );
  await pw0.click({ clickCount: 3 });
  await pw0.type("Kurasapo-111", { delay: 5 });
  await pw1.click({ clickCount: 3 });
  await pw1.type("Kurasapo-111", { delay: 5 });
  await next();
  await page.waitForFunction(() => document.body.innerText.includes("STEP 4"), {
    timeout: 10000,
  });

  console.log("OK: メール確認・Kurasapo-111・パスワード強度");
  await browser.close();
})().catch((e) => {
  console.error("失敗:", e.message);
  process.exit(1);
});
