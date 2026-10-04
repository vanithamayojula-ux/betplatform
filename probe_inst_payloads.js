import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("probe_log.txt", str + "\n");
  console.log(str);
}

fs.writeFileSync("probe_log.txt", "STARTING PROBE PAYLOADS TEST...\n");

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
  const headers = { "Content-Type": "application/json", Authorization: token };
  const base = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}`;

  const tests = [
    // POST lesson inst
    { method: "POST", url: `${base}/bet-section-insts/177439/bet-section-unit-insts/941821/bet-section-unit-lesson-insts`, body: { section_unit_lesson_id: 1146, test_definition_section_id: 53860 } },
    { method: "POST", url: `${base}/bet-section-insts/177439/bet-section-unit-insts/941821/bet-section-unit-lesson-insts`, body: { section_unit_lesson_id: 1146, test_definition_id: 9203448 } },
    { method: "POST", url: `${base}/bet-section-insts/177439/bet-section-unit-insts/941821/bet-section-unit-lesson-insts`, body: { section_unit_lesson_id: 1146, test_definition_section_id: 53860, test_definition_id: 9203448 } },

    // GET / POST exam creation endpoints
    { method: "POST", url: `${base}/bet-section-unit-lesson-insts/8145524/next`, body: {} },
    { method: "POST", url: `${base}/bet-section-insts/177439/bet-section-unit-insts/941821:unlock`, body: {} },
    { method: "POST", url: `${base}/bet-section-insts/177439/bet-section-unit-insts/941821/unlock`, body: {} },
    { method: "POST", url: `${base}/bet-section-insts/177439/bet-section-unit-insts/941821/bet-section-unit-lesson-insts/1146:unlock`, body: {} },
    { method: "POST", url: `${base}/bet-section-insts/177439/bet-section-unit-insts/941821/bet-section-unit-lesson-insts/1146`, body: {} },
    
    // POST create exam directly with test_definition_section_id
    { method: "POST", url: `${base}/bet-exams`, body: { test_definition_section_id: 53860 } },
    { method: "POST", url: `${base}/bet-section-insts/177439/bet-exams`, body: { test_definition_section_id: 53860 } },
  ];

  for (const t of tests) {
    try {
      const res = await fetch(t.url, {
        method: t.method,
        headers,
        body: JSON.stringify(t.body),
      });
      const txt = await res.text();
      log(`${t.method} ${t.url} body=${JSON.stringify(t.body)} -> status=${res.status}: ${txt.slice(0, 200)}`);
    } catch (e) {
      log(`Error ${t.url}: ${e.message}`);
    }
  }
}

probe();
