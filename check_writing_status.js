import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12517515",
  userEmail: "12517515@lpu.in",
  userPassCombo: [
    { username: "12517515@lpu.in", password: "12517515" }
  ],
  authToken: process.env.TOKEN,
  writingSectionInstId: "176869",
  targetUnits: [
    { uId: 941805, name: "Writing Topic 1 (Writing Job Descriptions)" },
    { uId: 941820, name: "Writing Topic 2 (Professional Email Writing)" }
  ]
};

const headers = { "Content-Type": "application/json" };
if (CONFIG.authToken) headers["Authorization"] = CONFIG.authToken;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function loginIfNeeded() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
  for (const c of CONFIG.userPassCombo) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: c.username, password: c.password, appContext: "BET_CORPORATE" }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        const rawToken = data.jwtToken || data.token || data.id_token;
        if (rawToken) {
          const token = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
          CONFIG.authToken = token;
          headers["Authorization"] = token;
          return token;
        }
      }
    } catch (e) {}
  }
}

async function checkWriting() {
  await loginIfNeeded();
  let doneCount = 0;
  let totalCount = 0;

  for (const u of CONFIG.targetUnits) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/${CONFIG.writingSectionInstId}/bet-section-unit-insts/${u.uId}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.log(`Failed to fetch ${u.name}`);
      continue;
    }
    const lessons = await res.json();
    console.log(`\n=== ${u.name} (${lessons.length} lessons) ===`);
    for (const l of lessons) {
      totalCount++;
      const insts = l.section_unit_lesson_insts || [];
      const inst = insts.find(i => i.is_latest) || insts.slice(-1)[0];
      const status = inst?.bet_status || l.lesson_status;
      const pct = inst?.percentage;
      const isDone = status === "COMPLETED" || status === "PASSED";
      if (isDone) doneCount++;
      console.log(`L${l.seq_no} (${l.lesson_name}): status=${status}, pct=${pct}, done=${isDone}`);
    }
  }

  console.log(`\nTotal Progress: ${doneCount} / ${totalCount} done (${Math.round(doneCount/totalCount * 100)}%)`);
}

checkWriting().catch(console.error);
