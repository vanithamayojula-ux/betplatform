import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("inst_fields_log.txt", str + "\n");
  console.log(str);
}

fs.writeFileSync("inst_fields_log.txt", "INSPECTING LESSON INST FIELDS...\n");

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

async function inspect() {
  const token = await login();
  const headers = { Authorization: token };
  
  // Inspect Unit 941805 (all 15 instantiated)
  const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/177439/bet-section-unit-insts/941805/bet-section-unit-lesson-insts`;
  const res = await fetch(url, { headers });
  if (res.ok) {
    const list = await res.json();
    log("=== Unit 941805 Sample Lessons ===");
    log(list.slice(0, 3));
  }
}

inspect();
