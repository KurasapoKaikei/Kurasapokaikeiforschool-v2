import puppeteer from "puppeteer"

const base = process.env.BASE_URL || "http://localhost:3002"

const corruptPayloads = [
  null,
  "not-json",
  "[]",
  "[null]",
  '[{"id":"x"}]',
  '[{"id":"1","subject":"a","body":"b","readByClubIds":"bad"}]',
]

const browser = await puppeteer.launch({ headless: "new" })
const page = await browser.newPage()
const errors = []
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))

for (const payload of corruptPayloads) {
  errors.length = 0
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 20000 })
  await page.evaluate((p) => {
    localStorage.setItem("school_to_club_messages", p === null ? "null" : String(p))
  }, payload)

  await page.goto(`${base}/club/dashboard`, { waitUntil: "networkidle2", timeout: 20000 })
  await new Promise((r) => setTimeout(r, 800))

  const clubSidebar = await page.evaluate(() => {
    const btn = document.querySelector('aside button[type="button"], aside button:not([type])')
    const before = btn?.textContent?.trim()
    btn?.click()
    return { hasBtn: !!btn, before, expanded: document.querySelector("aside .ml-8") != null }
  })

  await page.goto(`${base}/school`, { waitUntil: "networkidle2", timeout: 20000 })
  await new Promise((r) => setTimeout(r, 800))

  const schoolSidebar = await page.evaluate(() => {
    const btn = document.querySelector('aside button[type="button"]')
    btn?.click()
    return { hasBtn: !!btn, expanded: document.querySelector("aside .ml-8") != null }
  })

  console.log(JSON.stringify({ payload, errors: [...errors], clubSidebar, schoolSidebar }))
}

await browser.close()
