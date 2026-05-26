import puppeteer from "puppeteer"

const base = process.env.BASE_URL || "http://localhost:3002"

const browser = await puppeteer.launch({ headless: "new" })
const page = await browser.newPage()
const errors = []
page.on("pageerror", (e) => errors.push(e.message))

await page.goto(`${base}/`, { waitUntil: "domcontentloaded" })
await page.evaluate(() => {
  localStorage.setItem("school_to_club_messages", "[null, {}, {\"id\":\"1\",\"subject\":\"t\",\"body\":\"b\",\"readByClubIds\":1}]")
})

const club = await page.evaluate(async () => {
  location.href = "/club/dashboard"
  await new Promise((r) => setTimeout(r, 2000))
  const btn = [...document.querySelectorAll("aside nav button")].find((b) =>
    b.textContent?.includes("入出金登録")
  )
  const linksBefore = document.querySelectorAll("aside .ml-8 a").length
  btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  await new Promise((r) => setTimeout(r, 400))
  const linksAfter = document.querySelectorAll("aside .ml-8 a").length
  const msg = [...document.querySelectorAll("aside a")].find((a) =>
    a.textContent?.includes("メッセージBOX")
  )
  msg?.click()
  return { linksBefore, linksAfter, path: location.pathname }
})
await new Promise((r) => setTimeout(r, 1500))

const school = await page.evaluate(async () => {
  location.href = "/school"
  await new Promise((r) => setTimeout(r, 2000))
  const btn = [...document.querySelectorAll("aside button[type='button']")].find((b) =>
    b.textContent?.includes("クラブ管理")
  )
  const linksBefore = document.querySelectorAll("aside .ml-8 a").length
  btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  await new Promise((r) => setTimeout(r, 400))
  const linksAfter = document.querySelectorAll("aside .ml-8 a").length
  const msg = [...document.querySelectorAll("aside a")].find((a) =>
    a.textContent?.includes("メッセージBOX")
  )
  msg?.click()
  return { linksBefore, linksAfter, path: location.pathname }
})
await new Promise((r) => setTimeout(r, 1500))

console.log(
  JSON.stringify(
    { errors, club, clubUrl: page.url(), school, schoolUrl: page.url() },
    null,
    2
  )
)
await browser.close()
