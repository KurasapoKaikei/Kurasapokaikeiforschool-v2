/** 決算日・支払いサイクルロジックの単体確認 */
const DAYS = { 1:31,2:28,3:31,4:30,5:31,6:30,7:31,8:31,9:30,10:31,11:30,12:31 };
function getMaxDaysInMonth(m) { return DAYS[m] ?? 31; }
function clamp(m, d) { return Math.min(Math.max(1,d), getMaxDaysInMonth(m)); }

let ok = true;
for (const [m, exp] of [[2,28],[6,30],[3,31]]) {
  const max = getMaxDaysInMonth(m);
  const c = clamp(m, 31);
  if (max !== exp || c !== exp) { console.log("FAIL", m, max, c); ok = false; }
  else console.log(`OK ${m}月: 最大${max}日, 31日→${c}日`);
}
function isValidAdminPassword(p) {
  if (p.length < 8) return false;
  if (!/[A-Z]/.test(p)) return false;
  if (!/[a-z]/.test(p)) return false;
  if (!/\d/.test(p)) return false;
  if (!/[!@#$%^&*()_=+[\]{}|;:',.<>?/`~\-]/.test(p)) return false;
  return true;
}
for (const [p, exp] of [
  ["1234", false],
  ["admin", false],
  ["Kurasapo123!", true],
  ["Kurasapo-111", true],
]) {
  if (isValidAdminPassword(p) !== exp) {
    console.log("FAIL password", p);
    ok = false;
  } else console.log(`OK password: ${p} => ${exp}`);
}
process.exit(ok ? 0 : 1);
