import "dotenv/config";
import fs from "fs";

const CONFIG = {
  baseUrl: "https://corporate.bharatenglish.org",
  orgSlug: "lpu724598",
  userId: "12505612",
  userEmail: "12505612@lpu.in",
  userPass: "12505612",
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function login() {
  const url = `${CONFIG.baseUrl}/api/public/bet-exams/login`;
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
  return rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
}

async function inspectAll() {
  const token = await login();
  const headers = { Authorization: token };
  
  const units = [941831, 941832, 941829, 941830, 941833, 941834];
  let logStr = "=== ALL SPEAKING UNITS OVERVIEW ===\n";
  
  for (const u of units) {
    const url = `${CONFIG.baseUrl}/api/orgs/${CONFIG.orgSlug}/users/${CONFIG.userId}/bet-section-insts/177430/bet-section-unit-insts/${u}/bet-section-unit-lesson-insts`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      logStr += `Unit ${u}: HTTP ${res.status}\n`;
      continue;
    }
    const list = await res.json();
    let comp = 0, unlocked = 0;
    list.forEach(l => {
      const inst = (l.section_unit_lesson_insts || [])[0];
      const st = inst?.bet_status || l.lesson_status;
      const pct = inst?.percentage;
      if (st === "COMPLETED" || st === "PASSED" || (pct != null && pct >= 70)) comp++;
      if (l.lesson_status !== "LOCKED" || inst?.exam_id) unlocked++;
    });
    logStr += `Unit ${u}: Total=${list.length}, Unlocked=${unlocked}, Passed/Completed=${comp}\n`;
    list.forEach(l => {
      const inst = (l.section_unit_lesson_insts || [])[0];
      logStr += `  - L${l.seq_no} "${l.lesson_name}": status=${l.lesson_status}, bet_status=${inst?.bet_status}, pct=${inst?.percentage}%\n`;
    });
  }
  
  fs.writeFileSync("C:\\Users\\HP\\OneDrive\\Desktop\\betplatform\\speaking_overview.txt", logStr, "utf8");
}

await inspectAll();
