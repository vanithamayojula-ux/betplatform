import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  authToken: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const endpoints = [
  "bet-dashboard",
  "bet-tracks",
  "bet-track-insts",
  "bet-section-insts",
  "bet-modules",
];

async function run() {
  const results = {};
  for (const ep of endpoints) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/${ep}`;
    try {
      const res = await fetch(url, { headers: { Authorization: CONFIG.authToken } });
      if (res.ok) {
        results[ep] = await res.json();
      } else {
        results[ep] = { status: res.status, text: await res.text() };
      }
    } catch (e) {
      results[ep] = { error: e.message };
    }
  }
  fs.writeFileSync("user_dashboard.json", JSON.stringify(results, null, 2));
  console.log("Dashboard endpoints checked.");
}

run();
