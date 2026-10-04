import "dotenv/config";
import fs from "fs";

function log(msg) {
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  fs.appendFileSync("direct_log.txt", str + "\n");
  console.log(str);
}

fs.writeFileSync("direct_log.txt", "STARTING DIRECT EXAM CREATION TEST...\n");

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

async function testDirect() {
  const token = await login();
  const headers = { "Content-Type": "application/json", Authorization: token };
  const testDefId = 9203448;
  const sectionUnitLessonId = 1146;

  const endpoints = [
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams`,
      body: { test_definition_id: testDefId },
    },
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams`,
      body: { section_unit_lesson_id: sectionUnitLessonId },
    },
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-exams`,
      body: { test_definition_id: testDefId, section_unit_lesson_id: sectionUnitLessonId },
    },
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/177439/bet-exams`,
      body: { test_definition_id: testDefId },
    },
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/177439/bet-section-unit-insts/941821/bet-exams`,
      body: { test_definition_id: testDefId },
    },
    {
      url: `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/177439/bet-section-unit-insts/941821/bet-section-unit-lesson-insts`,
      body: { section_unit_lesson_id: sectionUnitLessonId },
    },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers,
        body: JSON.stringify(ep.body),
      });
      const txt = await res.text();
      log(`POST ${ep.url} payload=${JSON.stringify(ep.body)} -> status=${res.status}: ${txt}`);
    } catch (e) {
      log("Error: " + e.message);
    }
  }
}

testDirect();
