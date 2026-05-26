import puppeteer from "puppeteer"

const base = process.env.BASE_URL || "http://localhost:3002"

const browser = await puppeteer.launch({ headless: "new" })
const page = await browser.newPage()
const errors = []
page.on("pageerror", (e) => errors.push(e.message))

await page.goto(`${base}/club/dashboard`, { waitUntil: "networkidle2", timeout: 30000 })
await page.evaluate(() => localStorage.removeItem("school_to_club_messages"))

// Club: expand 入出金登録
const clubExpand = await page.evaluate(async () => {
  const buttons = [...document.querySelectorAll("aside nav button")]
  const target = buttons.find((b) => b.textContent?.includes("入出金登録"))
  if (!target) return { ok: false, reason: "no button" }
  const subsBefore = document.querySelectorAll("aside .ml-8 a").length
  target.click()
  await new Promise((r) => setTimeout(r, 300))
  const subsAfter = document.querySelectorAll("aside .ml-8 a").length
  return { ok: true, subsBefore, subsAfter, btnCount: buttons.length }
})

// Club: navigate via link
const clubNav = await page.evaluate(() => {
  const link = [...document.querySelectorAll("aside a")].find((a) =>
    a.textContent?.includes("メッセージBOX")
  )
  if (!link) return { ok: false }
  link.click()
  return { ok: true, href: link.getAttribute("href") }
})
await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {})
const clubPath = new URL(page.url()).pathname

await page.goto(`${base}/school`, { waitUntil: "networkidle2", timeout: 30000 })

const schoolExpand = await page.evaluate(async () => {
  const buttons = [...document.querySelectorAll("aside button[type='button']")]
  const target = buttons.find((b) => b.textContent?.includes("クラブ管理"))
  if (!target) return { ok: false, reason: "no button", buttons: buttons.map((b) => b.textContent?.trim()) }
  const subsBefore = document.querySelectorAll("aside .ml-8 a").length
  target.click()
  await new Promise((r) => setTimeout(r, 300))
  const subsAfter = document.querySelectorAll("aside .ml-8 a").length
  return { ok: true, subsBefore, subsAfter }
})

const schoolNav = await page.evaluate(() => {
  const link = [...document.querySelectorAll("aside a")].find((a) =>
    a.textContent?.includes("メッセージBOX")
  )
  if (!link) return { ok: false }
  link.click()
  return { ok: true }
})
await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {})
const schoolPath = new URL(page.url()).pathname

console.log({ errors, clubExpand, clubNav, clubPath, schoolExpand, schoolNav, schoolPath })
await browser.close()
