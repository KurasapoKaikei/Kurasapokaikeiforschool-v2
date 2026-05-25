/** クラブ登録画面：タブ別 No. 表示の E2E */
const runE2E = process.argv.includes("--e2e");
const baseArg = process.argv.find((a) => a.startsWith("http"));
const BASE = baseArg || process.env.BASE_URL || "http://localhost:3000";

function getOrderNumbers(text) {
  const rows = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const nums = [];
  for (const line of rows) {
    if (/^\d+$/.test(line) && nums.length < 20) nums.push(Number(line));
  }
  return nums;
}

if (!runE2E) {
  console.log("使い方: node scripts/test-club-register-tab-index.mjs --e2e");
  process.exit(0);
}

let puppeteer;
try {
  puppeteer = (await import("puppeteer")).default;
} catch {
  console.error("puppeteer が必要です");
  process.exit(1);
}

const seedGroups = [
  { id: "grp-culture", name: "文化系", order: 1 },
  { id: "grp-sports", name: "運動系", order: 2 },
];
const seedClubs = [
  {
    id: "club-1",
    name: "新聞会",
    groupIds: ["grp-culture"],
    groupNames: ["文化系"],
    registeredAt: new Date().toISOString(),
    order: 1,
    initialPassword: "Ab12cd",
    password: "Ab12cd",
  },
  {
    id: "club-2",
    name: "美術部",
    groupIds: ["grp-culture"],
    groupNames: ["文化系"],
    registeredAt: new Date().toISOString(),
    order: 2,
    initialPassword: "Cd34ef",
    password: "Cd34ef",
  },
  {
    id: "club-3",
    name: "吹奏楽部",
    groupIds: ["grp-culture"],
    groupNames: ["文化系"],
    registeredAt: new Date().toISOString(),
    order: 3,
    initialPassword: "Gh56ij",
    password: "Gh56ij",
  },
  {
    id: "club-4",
    name: "サッカー部",
    groupIds: ["grp-sports"],
    groupNames: ["運動系"],
    registeredAt: new Date().toISOString(),
    order: 4,
    initialPassword: "Kl78mn",
    password: "Kl78mn",
  },
  {
    id: "club-5",
    name: "バスケ部",
    groupIds: ["grp-sports"],
    groupNames: ["運動系"],
    registeredAt: new Date().toISOString(),
    order: 5,
    initialPassword: "Op90qr",
    password: "Op90qr",
  },
];

const browser = await puppeteer.launch({ headless: true });
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
  await page.waitForFunction(() => document.body.innerText.includes("登録済みクラブ"), {
    timeout: 15000,
  });

  const readOrderCells = () =>
    page.evaluate(() => {
      const rows = document.querySelectorAll(".space-y-2 > div");
      return [...rows].map((row) => {
        const num = row.querySelector(".tabular-nums");
        return num ? Number(num.textContent.trim()) : null;
      }).filter((n) => n !== null);
    });

  await page.click('button[type="button"]');
  const allTab = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll("button")];
    const t = tabs.find((b) => b.textContent?.trim() === "すべて");
    t?.click();
    return !!t;
  });
  if (!allTab) throw new Error("すべてタブが見つからない");

  await new Promise((r) => setTimeout(r, 300));
  const allOrders = await readOrderCells();
  if (allOrders.join(",") !== "1,2,3,4,5") {
    throw new Error(`すべてタブの連番: 期待 1,2,3,4,5 実際 ${allOrders.join(",")}`);
  }
  console.log("OK: すべてタブで 1〜5 の連番");

  const cultureTab = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll("button")];
    const t = tabs.find((b) => b.textContent?.trim() === "文化系");
    t?.click();
    return !!t;
  });
  if (!cultureTab) throw new Error("文化系タブが見つからない");

  await new Promise((r) => setTimeout(r, 300));
  const cultureOrders = await readOrderCells();
  if (cultureOrders.join(",") !== "1,2,3") {
    throw new Error(
      `文化系タブ: 期待 1,2,3（タブ内連番）実際 ${cultureOrders.join(",")}`
    );
  }
  const firstCulture = await page.evaluate(() => {
    const row = document.querySelector(".space-y-2 > div");
    const name = row?.querySelector(".font-semibold")?.textContent?.trim();
    const num = row?.querySelector(".tabular-nums")?.textContent?.trim();
    return { name, num };
  });
  if (firstCulture.num !== "1") {
    throw new Error(`文化系先頭が1ではない: ${JSON.stringify(firstCulture)}`);
  }
  if (firstCulture.name !== "新聞会") {
    throw new Error(`文化系先頭クラブ名: ${firstCulture.name}`);
  }
  console.log("OK: 文化系タブで 1,2,3（先頭は新聞会が No.1）");

  console.log("E2E完了");
} catch (e) {
  console.error("E2E失敗:", e.message);
  process.exit(1);
} finally {
  await browser.close();
}
