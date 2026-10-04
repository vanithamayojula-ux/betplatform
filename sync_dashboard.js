import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("sync_log.txt", str + "\n");
  console.log(str);
}

fs.writeFileSync("sync_log.txt", "STARTING DASHBOARD SYNC...\n");

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

async function sync() {
  const token = await login();
  const headers = { Authorization: token };
  const base = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}`;

  const endpoints = [
    "bet-dashboard",
    "bet-tracks",
    "bet-track-insts",
    "bet-section-insts",
    "bet-section-insts/177439",
    "bet-section-insts/177439/bet-section-unit-insts",
    "bet-section-insts/177439/bet-section-unit-insts/941821",
    "bet-section-insts/177439/bet-section-unit-insts/941821/bet-section-unit-lesson-insts",
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${base}/${ep}`, { headers });
      log(`GET ${ep} -> status=${res.status}`);
    } catch (e) {
      log(`Error GET ${ep}: ${e.message}`);
    }
  }

  // Now check L2 status again
  const checkUrl = `${base}/bet-section-insts/177439/bet-section-unit-insts/941821/bet-section-unit-lesson-insts`;
  const res = await fetch(checkUrl, { headers });
  if (res.ok) {
    const list = await res.json();
    log({
      L1: { status: list[0]?.lesson_status, inst: list[0]?.section_unit_lesson_insts?.[0] },
      L2: { status: list[1]?.lesson_status, inst: list[1]?.section_unit_lesson_insts?.[0] },
    });
  }
}

sync();
