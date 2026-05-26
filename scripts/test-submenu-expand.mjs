import puppeteer from "puppeteer"

const browser = await puppeteer.launch({ headless: "new" })
const page = await browser.newPage()
await page.goto("http://localhost:3002/club/dashboard", { waitUntil: "networkidle2" })

const result = await page.evaluate(async () => {
  const buttons = [...document.querySelectorAll("aside nav > div > button")]
  const target = buttons.find((b) => b.textContent?.includes("入出金登録"))
  if (!target) return { error: "no target", buttonLabels: buttons.map((b) => b.textContent?.trim()) }
  const countLinks = () =>
    [...document.querySelectorAll("aside nav a")].map((a) => a.textContent?.trim())
  const before = countLinks()
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  await new Promise((r) => setTimeout(r, 500))
  const after = countLinks()
  return { before: before.length, after: after.length, added: after.filter((x) => !before.includes(x)) }
})

console.log(result)
await browser.close()
