import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  userEmail: "12505612@lpu.in",
  userPass: "12505612",
  authToken: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function run() {
  const loginRes = await fetch(`${CONFIG.baseUrl}/api/public/bet-exams/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: CONFIG.userEmail,
      password: CONFIG.userPass,
      appContext: "BET_CORPORATE",
    }),
  });
  if (loginRes.ok) {
    const d = await loginRes.json();
    CONFIG.authToken = d.token ? (d.token.startsWith("Bearer ") ? d.token : `Bearer ${d.token}`) : CONFIG.authToken;
    console.log("Logged in. User data:", JSON.stringify(d, null, 2));
    fs.writeFileSync("login_response.json", JSON.stringify(d, null, 2));
  }
}

run().catch(console.error);
