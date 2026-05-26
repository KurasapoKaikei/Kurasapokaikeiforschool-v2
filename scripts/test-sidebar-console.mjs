import puppeteer from "puppeteer"

const base = process.env.BASE_URL || "http://localhost:3000"
const paths = ["/school", "/school/messages", "/club/dashboard", "/club/messages"]

const browser = await puppeteer.launch({ headless: "new" })
for (const path of paths) {
  const page = await browser.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text())
  })
  try {
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 15000 })
    await new Promise((r) => setTimeout(r, 1500))
    const clicked = await page.evaluate(() => {
      const link = document.querySelector("aside nav a, aside a")
      if (!link) return { ok: false, reason: "no link" }
      const before = location.pathname
      link.click()
      return { ok: true, before, after: location.pathname }
    })
    await new Promise((r) => setTimeout(r, 1000))
    const afterPath = page.url()
    console.log(path, { errors: errors.slice(0, 3), clicked, afterPath })
  } catch (e) {
    console.log(path, "FAIL", e.message)
  }
  await page.close()
}
await browser.close()
