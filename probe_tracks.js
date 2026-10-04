import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("tracks_log.txt", str + "\n");
  console.log(str);
}

fs.writeFileSync("tracks_log.txt", "PROBING TRACKS AND SECTIONS...\n");

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  userEmail: "12505612@lpu.in",
  userPass: "12505612",
  authToken: process.env.TOKEN,
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function login() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: CONFIG.userEmail,
        password: CONFIG.userPass,
        appContext: "BET_CORPORATE",
      }),
    });
    const data = await res.json();
    const rawToken = data.jwtToken || data.token || data.id_token;
    return rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : CONFIG.authToken;
  } catch (e) {
    return CONFIG.authToken;
  }
}

async function probe() {
  const token = await login();
  const headers = { Authorization: token };

  const endpoints = [
    `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-track-insts`,
    `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/prep-tracks`,
    `/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-dashboard`,
    `/api/orgs/${CONFIG.orgSlug}/bet-tracks`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(CONFIG.baseUrl + ep, { headers });
      const txt = await res.text();
      log(`${ep} -> status=${res.status}: ${txt.slice(0, 1000)}`);
    } catch (e) {
      log(`Error ${ep}: ${e.message}`);
    }
  }
}

probe();
