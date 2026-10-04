import "dotenv/config";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userEmail: "1252613@lpu.in",
  userPass: "1252613",
  combos: [
    { username: "1252613@lpu.in", password: "1252613", appContext: "BET_CORPORATE" },
    { username: "1252613", password: "1252613", appContext: "BET_CORPORATE" },
    { username: "1252613@lpu.in", password: "1252613@lpu.in", appContext: "BET_CORPORATE" },
    { username: "1252613@lpu.in", password: "1252613", appContext: "BET" },
    { username: "1252613", password: "1252613", appContext: "BET" }
  ]
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function testAllLogins() {
  for (const c of CONFIG.combos) {
    console.log(`Testing username="${c.username}", pass="${c.password}", appContext="${c.appContext}"...`);
    const res = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c)
    });
    const text = await res.text();
    console.log(` -> HTTP ${res.status} | Body: ${text.slice(0, 300)}`);
  }
}

testAllLogins().catch(console.error);
