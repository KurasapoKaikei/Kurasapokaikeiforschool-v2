import puppeteer from "puppeteer";

const BASE =
  process.argv[2] ||
  process.env.BASE_URL ||
  "http://localhost:3001";

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${BASE}/register/school`, { waitUntil: "networkidle0" });

  const fillAndNext = async () => {
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")];
      buttons.find((b) => b.textContent?.includes("次へ"))?.click();
    });
  };

  await page.evaluate(() => {
    const set = (ph, v) => {
      const el = [...document.querySelectorAll("input")].find(
        (i) => i.placeholder === ph
      );
      if (el) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(el, v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    set("例：クラサポ大学", "クラサポ大学");
    set("例：倉部", "倉部");
    set("例：太郎", "太郎");
    set("例：クラブ", "クラブ");
    set("例：タロウ", "タロウ");
    set("例：102-0074", "102-0074");
    set("例：東京都", "東京都");
    set("例：千代田区", "千代田区");
    set("例：富士見台2-11-1", "富士見台2-11-1");
    set("例：03-5211-7171", "03-5211-7171");
  });
  await fillAndNext();
  await page.waitForFunction(() => document.body.innerText.includes("STEP 2"), {
    timeout: 10000,
  });

  await page.evaluate(() => {
    const set = (ph, v) => {
      const el = [...document.querySelectorAll("input")].find(
        (i) => i.placeholder === ph
      );
      if (el) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(el, v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    set("例：学生支援課 部活動統括係", "学生支援課");
    set("例：会計", "会計");
    set("例：花子", "花子");
    set("例：カイケイ", "カイケイ");
    set("例：ハナコ", "ハナコ");
    set("例：03-5211-7172", "03-5211-7172");
  });
  const e0 = await page.waitForSelector('[data-testid="register-contact-email"]');
  const e1 = await page.waitForSelector(
    '[data-testid="register-contact-email-confirm"]'
  );
  await e0.click({ clickCount: 3 });
  await e0.type("hanako@example.com", { delay: 5 });
  await e1.click({ clickCount: 3 });
  await e1.type("hanako@example.com", { delay: 5 });
  await fillAndNext();
  await page.waitForFunction(() => document.body.innerText.includes("STEP 3"), {
    timeout: 10000,
  });

  // STEP3: 決算月・支払い（プラン select を除く最初の2つが決算日月）
  await page.evaluate(() => {
    const selects = [...document.querySelectorAll("select")].filter((s) =>
      [...s.options].some((o) => o.textContent?.includes("月") && o.value === "6")
    );
    const monthSel = selects[0];
    monthSel.value = "6";
    monthSel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 400));
  const juneLen = await page.evaluate(() => {
    const monthSel = [...document.querySelectorAll("select")].find((s) =>
      s.value === "6" && [...s.options].some((o) => o.textContent?.endsWith("月"))
    );
    const daySel = monthSel?.parentElement?.parentElement?.querySelectorAll("select")[1];
    return daySel?.options.length ?? 0;
  });
  if (juneLen !== 30) throw new Error(`6月の日数: ${juneLen}`);

  await page.evaluate(() => {
    const monthSel = [...document.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.textContent === "2月")
    );
    monthSel.value = "2";
    monthSel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 400));
  const febLast = await page.evaluate(() => {
    const monthSel = [...document.querySelectorAll("select")].find((s) => s.value === "2");
    const daySel = monthSel?.parentElement?.parentElement?.querySelectorAll("select")[1];
    return Number(daySel?.options[daySel.options.length - 1]?.value ?? 0);
  });
  if (febLast !== 28) throw new Error(`2月の最終日: ${febLast}`);

  const monthlyOpts = await page.evaluate(() => {
    const radios = [...document.querySelectorAll('input[name="paymentCycle"]')];
    const monthly = radios.find((r) => r.value === "on" && r.parentElement?.textContent?.includes("月払い"));
    (monthly ?? radios[0])?.click();
    const paySel = [...document.querySelectorAll("select")].find(
      (s) =>
        s.options.length === 3 &&
        [...s.options].some((o) => o.textContent === "10日") &&
        [...s.options].some((o) => o.textContent === "末日")
    );
    return paySel ? [...paySel.options].map((o) => o.textContent) : [];
  });
  if (
    !monthlyOpts.includes("10日") ||
    !monthlyOpts.includes("26日") ||
    !monthlyOpts.includes("末日")
  ) {
    throw new Error("月払い日: " + monthlyOpts.join(","));
  }

  const yearlyText = await page.evaluate(() => {
    const radios = [...document.querySelectorAll('input[name="paymentCycle"]')];
    const yearly = radios.find((r) => r.parentElement?.textContent?.includes("年払い"));
    yearly?.click();
    return document.body.innerText;
  });
  if (!yearlyText.includes("決算月（2月）の月末")) throw new Error("年払い表示なし");

  const reg = {
    schoolId: "SCH-99001",
    status: "pending",
    createdAt: new Date().toISOString(),
    adminPassword: "pass1234",
    school: {
      schoolName: "テスト大学",
      representativeName: "倉部太郎",
      representativeNameKana: "クラサ タロウ",
      postalCode: "100",
      prefecture: "東京都",
      city: "千代田区",
      addressLine: "1",
      phone: "03",
    },
    contact: {
      department: "庶務",
      position: "",
      contactName: "倉部花子",
      contactNameKana: "クラサ ハナコ",
      contactPhone: "03",
      email: "t@t.jp",
    },
    contract: {
      plan: "standard",
      settlementMonth: 3,
      settlementDay: 31,
      paymentCycle: "yearly",
      monthlyBillingDay: 31,
      paymentMethod: "bank_transfer",
    },
    termsAcceptedAt: new Date().toISOString(),
  };
  await page.evaluate((data) => {
    localStorage.setItem(
      "kurasaokaikei-school-registrations",
      JSON.stringify({ [data.schoolId]: data })
    );
  }, reg);
  await page.goto(`${BASE}/register/verify?id=${reg.schoolId}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => location.pathname.includes("/school/clubs"),
    { timeout: 20000 }
  );
  await page.goto(`${BASE}/school/contract`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));
  const body = await page.evaluate(() => document.body.innerText);
  if (!body.includes("年払い")) throw new Error("契約: 年払いなし");
  if (!body.includes("3月31日")) throw new Error("契約: 決算日なし");

  console.log("OK: 決算日制限・支払いサイクル・本登録連動");
  await browser.close();
})().catch((e) => {
  console.error("失敗:", e.message);
  process.exit(1);
});
