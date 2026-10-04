import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("inst_nested_log.txt", str + "\n");
  console.log(str);
}

fs.writeFileSync("inst_nested_log.txt", "STARTING NESTED L2 INSTANTIATION TEST...\n");

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

async function instantiate() {
  const token = await login();
  const headers = { "Content-Type": "application/json", Authorization: token };
  const base = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}`;
  const lessonId = 1146; // L2 of Unit 941821
  const testDefId = 9203448;
  const testDefSecId = 53860;

  const sections = [177431, 177439, 177433, 177441, 177445];

  for (const s of sections) {
    const url = `${base}/bet-section-insts/${s}/bet-section-unit-insts/941821/bet-section-unit-lesson-insts`;
    
    const payloads = [
      { section_unit_lesson_id: lessonId },
      { section_unit_lesson_id: lessonId, test_definition_id: testDefId },
      { section_unit_lesson_id: lessonId, test_definition_section_id: testDefSecId },
      { test_definition_id: testDefId },
      { test_definition_section_id: testDefSecId },
    ];

    for (const p of payloads) {
      try {
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(p) });
        const txt = await res.text();
        log(`POST section ${s} payload=${JSON.stringify(p)} -> status=${res.status}: ${txt.slice(0, 250)}`);
      } catch (e) {
        log(`Err sec ${s}: ${e.message}`);
      }
    }
  }
}

instantiate();
