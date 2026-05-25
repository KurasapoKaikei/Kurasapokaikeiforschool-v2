/** pending_school_data 単一エンベロープ形式の単体確認 */

function isPendingEnvelope(value) {
  if (!value || typeof value !== "object") return false;
  const v = value;
  return (
    typeof v.token === "string" &&
    typeof v.createdAt === "string" &&
    typeof v.adminPassword === "string" &&
    !!v.school?.schoolName &&
    !!v.contact?.email
  );
}

const token = "demo-auth-token";
const envelope = {
  token,
  createdAt: new Date().toISOString(),
  adminPassword: "Kurasapo-111",
  school: { schoolName: "X大学", representativeName: "a", representativeNameKana: "b", postalCode: "1", prefecture: "東", city: "区", addressLine: "1", phone: "03" },
  contact: { department: "総務", position: "", contactName: "花子", contactNameKana: "ハ", contactPhone: "03", email: "a@b.co" },
  contract: { plan: "standard", settlementMonth: 3, settlementDay: 31, paymentCycle: "monthly", monthlyBillingDay: 26, paymentMethod: "bank_transfer" },
  termsAcceptedAt: new Date().toISOString(),
};

const json = JSON.stringify(envelope);
const parsed = JSON.parse(json);
if (!isPendingEnvelope(parsed)) throw new Error("envelope invalid");
if (parsed.token !== token) throw new Error("token mismatch");
const url = `http://localhost:3000/register/verify?token=${encodeURIComponent(token)}`;
if (!url.includes("demo-auth-token")) throw new Error("url");
console.log("OK: エンベロープ形式・URLトークン一致");
