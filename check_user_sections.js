import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("user_sec_log.txt", str + "\n");
  console.log(str);
}

fs.writeFileSync("user_sec_log.txt", "STARTING USER SECTIONS CHECK...\n");

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

async function run() {
  const token = await login();
  const headers = { Authorization: token };
  const secUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts`;
  
  log(`[GET] ${secUrl}`);
  const secRes = await fetch(secUrl, { headers });
  log(`Status: ${secRes.status}`);
  if (!secRes.ok) {
    log(await secRes.text());
    return;
  }
  const sections = await secRes.json();
  log(`Found ${sections.length} sections:`);
  for (const s of sections) {
    log(`- Section id=${s.id || s.section_inst_id} name="${s.name || s.section_name}" status=${s.status || s.section_status || s.bet_status}`);
    
    const uUrl = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${s.id || s.section_inst_id}/bet-section-unit-insts`;
    const uRes = await fetch(uUrl, { headers });
    if (uRes.ok) {
      const units = await uRes.json();
      log(`  Found ${units.length} units:`);
      for (const u of units) {
        log(`  * Unit id=${u.id || u.section_unit_inst_id || u.unit_id} name="${u.name || u.unit_name}" status=${u.status || u.unit_status || u.bet_status}`);
      }
    }
  }
}

run();
