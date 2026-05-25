/** メール確認・パスワード記号の単体確認 */

const EMAIL_MISMATCH = "メールアドレスが一致しません";

function mergeEmailFieldErrors(email, emailConfirm, prev = {}) {
  const next = { ...prev };
  if (!email.trim()) next.email = "メールアドレスを入力してください";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    next.email = "有効なメールアドレスを入力してください";
  else delete next.email;

  if (!emailConfirm.trim())
    next.emailConfirm = "メールアドレス（確認）を入力してください";
  else if (email.trim() !== emailConfirm.trim())
    next.emailConfirm = EMAIL_MISMATCH;
  else delete next.emailConfirm;

  return next;
}

function isValidAdminPassword(p) {
  if (p.length < 8) return false;
  if (!/[A-Z]/.test(p)) return false;
  if (!/[a-z]/.test(p)) return false;
  if (!/\d/.test(p)) return false;
  if (!/[!@#$%^&*()_=+[\]{}|;:',.<>?/`~\-]/.test(p)) return false;
  return true;
}

let ok = true;

const mismatch = mergeEmailFieldErrors(
  "a@b.co",
  "x@b.co",
  {}
);
if (mismatch.emailConfirm !== EMAIL_MISMATCH) {
  console.log("FAIL mismatch", mismatch);
  ok = false;
} else console.log("OK: メール不一致エラー");

const match = mergeEmailFieldErrors("a@b.co", "a@b.co", {});
if (match.emailConfirm) {
  console.log("FAIL match should clear", match);
  ok = false;
} else console.log("OK: メール一致でエラーなし");

if (!isValidAdminPassword("Kurasapo-111")) {
  console.log("FAIL Kurasapo-111");
  ok = false;
} else console.log("OK: Kurasapo-111 パスワード");

process.exit(ok ? 0 : 1);
