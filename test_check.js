import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  userEmail: "12505612@lpu.in",
  userPass: "12505612",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

console.log("Logging in...");
const res = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: CONFIG.userEmail,
    password: CONFIG.userPass,
    appContext: "BET_CORPORATE",
  }),
});

console.log("Status:", res.status);
const data = await res.json();
console.log("Data:", data);
