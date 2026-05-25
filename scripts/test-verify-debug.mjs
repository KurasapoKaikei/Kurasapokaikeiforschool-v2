import puppeteer from "puppeteer";

const BASE = process.argv[2] || "http://localhost:3001";
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

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("console:", msg.text());
});
await page.goto(`${BASE}/register/school`, { waitUntil: "networkidle0" });
await page.evaluate((data) => {
  localStorage.setItem(
    "kurasaokaikei-school-registrations",
    JSON.stringify({ [data.schoolId]: data })
  );
}, reg);
await page.goto(`${BASE}/register/verify?id=SCH-99001`, {
  waitUntil: "networkidle0",
});
await new Promise((r) => setTimeout(r, 5000));
console.log("url:", page.url());
console.log("text:", (await page.evaluate(() => document.body.innerText)).slice(0, 500));
console.log(
  "ls:",
  await page.evaluate(() => ({
    reg: localStorage.getItem("kurasaokaikei-school-registrations"),
    contract: localStorage.getItem("contract_info"),
    session: localStorage.getItem("kurasaokaikei-school-admin-session"),
  }))
);
await browser.close();
