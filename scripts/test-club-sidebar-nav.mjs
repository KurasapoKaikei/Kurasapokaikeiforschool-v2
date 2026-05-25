import puppeteer from "puppeteer"

const base = process.env.BASE_URL || "http://localhost:3000"

async function clickSidebar(page, label) {
  const clicked = await page.evaluate((text) => {
    const el = [...document.querySelectorAll("aside nav a")].find((a) =>
      a.textContent?.trim().includes(text)
    )
    if (!el) return false
    el.click()
    return true
  }, label)
  if (!clicked) throw new Error(`Sidebar link not found: ${label}`)
}

async function main() {
  const browser = await puppeteer.launch({ headless: "new" })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  await page.goto(`${base}/club/dashboard`, { waitUntil: "networkidle0", timeout: 30000 })

  await clickSidebar(page, "メッセージBOX")
  await page.waitForFunction(() => location.pathname.endsWith("/messages"), { timeout: 10000 })
  const url1 = page.url()
  const text1 = await page.evaluate(() => document.body.innerText)
  console.log("messages url:", url1)
  console.log("has empty msg:", text1.includes("メッセージはまだありません"))

  await clickSidebar(page, "決算")
  await page.waitForFunction(() => location.pathname.endsWith("/settlement"), { timeout: 10000 })
  const url2 = page.url()
  const text2 = await page.evaluate(() => document.body.innerText)
  console.log("settlement url:", url2)
  console.log("has settlement:", /決算|提出/.test(text2))

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
